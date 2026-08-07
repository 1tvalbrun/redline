import { v } from "convex/values"
import { internalMutation, mutation, query, action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { materialFileType, validateMaterialFile } from "../src/lib/materials"
import { parseExtractedBrief } from "../src/lib/intake"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { getPack, isPackId, scopeOf } from "../src/domains/registry"
import type { Scope } from "../src/domains/types"
import { ownedOrNull, requireIdentity } from "./guard"

const MULTI_MAX_ITEMS = 8
const MULTI_ITEM_CHARS = 80
const TEXT_FALLBACK_CHARS = 60

export const create = mutation({
  args: {
    packId: v.string(),
    scope: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
    materials: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    if (!isPackId(args.packId)) throw new Error("Unknown lane")
    const pack = getPack(args.packId)

    // Scope values are interpolated into every downstream prompt, and the
    // UI can be bypassed — validate against the pack's field list: unknown
    // keys are dropped, free text is clamped, multi values are capped, and
    // fields with a declared vocabulary only accept its labels.
    const scope: Scope = {}
    for (const field of pack.scopeFields) {
      const raw = args.scope[field.key]
      const labels = field.options?.map((option) => option.label)
      if (field.kind === "multi") {
        if (Array.isArray(raw)) {
          const items = raw
            .slice(0, MULTI_MAX_ITEMS)
            .map((item) => item.trim().slice(0, MULTI_ITEM_CHARS))
          scope[field.key] = labels ? items.filter((item) => labels.includes(item)) : items
        }
      } else if (typeof raw === "string") {
        const value = raw.trim().slice(0, field.maxLength ?? TEXT_FALLBACK_CHARS)
        // Empty means "not chosen" for chip fields, same as the forms send.
        if (field.kind !== "chips" || !labels || value === "" || labels.includes(value)) {
          scope[field.key] = value
        }
      }
      if (field.required && !scope[field.key]) {
        throw new Error(`Missing ${field.label}`)
      }
    }

    const subject = scope[pack.subjectField]
    if (typeof subject !== "string" || subject.length === 0) {
      throw new Error("Missing a name for this run")
    }

    const existingIdea = await ctx.db
      .query("ideas")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", identity.subject).eq("name", subject)
      )
      .first()
    const ideaId =
      existingIdea?._id ??
      (await ctx.db.insert("ideas", { name: subject, userId: identity.subject }))
    const simulationId = await ctx.db.insert("simulations", {
      // The subject is the title; deriving it here keeps one validated
      // source instead of a second client-supplied copy.
      title: subject,
      packId: pack.id,
      scope,
      ideaId,
      userId: identity.subject,
      status: "draft",
      version: 1,
    })

    for (const upload of args.materials ?? []) {
      // The client validates before uploading; anything invalid here is a
      // bypass, so reject loudly rather than ingest it.
      const fileType = materialFileType(upload.name)
      if (fileType === null || validateMaterialFile(upload.name, upload.size) !== null) {
        throw new Error(`Unsupported material: ${upload.name}`)
      }
      const materialId = await ctx.db.insert("materials", {
        simulationId,
        storageId: upload.storageId,
        name: upload.name,
        fileType,
        size: upload.size,
        status: "extracting",
      })
      await ctx.scheduler.runAfter(0, internal.ingest.extract, { materialId })
    }

    return simulationId
  },
})

export const get = query({
  args: { id: v.id("simulations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return ownedOrNull(identity, await ctx.db.get(args.id))
  },
})

// Internal: status transitions are driven by simulations.analyze, never the
// client.
export const setStatus = internalMutation({
  args: {
    id: v.id("simulations"),
    status: v.union(v.literal("draft"), v.literal("analyzing"), v.literal("ready")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status })
  },
})

// Internal: written only by simulations.analyze, which filters the model
// output to the pack's contextFields before calling.
export const setContext = internalMutation({
  args: {
    id: v.id("simulations"),
    context: v.record(v.string(), v.string()),
    status: v.union(v.literal("draft"), v.literal("analyzing"), v.literal("ready")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      context: args.context,
      status: args.status,
    })
  },
})

export const analyze = action({
  args: { id: v.id("simulations") },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const simulation = await ctx.runQuery(api.simulations.get, { id: args.id })
    if (!simulation) throw new Error("Simulation not found")

    await ctx.runMutation(internal.simulations.setStatus, {
      id: args.id,
      status: "analyzing",
    })

    try {
      const openai = await createOpenAI()
      const model = resolveModel("fast")
      const pack = getPack(simulation.packId)

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: pack.prompts.analyzeSystem },
          { role: "user", content: pack.prompts.analyzeUser(scopeOf(simulation)) },
        ],
        response_format: { type: "json_object" },
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error("No response from OpenAI")

      // Hold the model to the pack's contract: every declared field, as a
      // string, nothing extra stored. A malformed response throws into the
      // catch below and reverts to draft, same as before.
      const parsed = JSON.parse(content) as Record<string, unknown>
      const context: Record<string, string> = {}
      for (const field of pack.contextFields) {
        const value = parsed[field.key]
        if (typeof value !== "string") throw new Error(`Analysis missing ${field.key}`)
        context[field.key] = value
      }

      await ctx.runMutation(internal.simulations.setContext, {
        id: args.id,
        context,
        status: "ready",
      })

      return context
    } catch (error) {
      // Simulations have no failed state, so a thrown analysis must not
      // strand the doc in "analyzing" forever — revert to draft and let the
      // Read stage's retry run it again.
      await ctx.runMutation(internal.simulations.setStatus, {
        id: args.id,
        status: "draft",
      })
      throw error
    }
  },
})

// Intake extraction: pitch text (voice transcript or deck text) → honest
// structured brief. Isolated from analyze — no reads, no writes; the founder
// reviews the result before anything is created.
export const extractBrief = action({
  args: {
    pitch: v.string(),
    source: v.union(v.literal("voice"), v.literal("deck")),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const openai = await createOpenAI()
    const model = resolveModel("fast")
    // Stateless intake with no simulation yet; the founder lane is the only
    // one with a pitch intake — packs without one never reach this action.
    const pack = getPack()
    const extractPrompt = pack.prompts.extractBrief
    if (!extractPrompt) throw new Error("This lane has no pitch intake")

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: extractPrompt({ source: args.source, pitch: args.pitch }),
        },
      ],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Extraction returned nothing")
    return parseExtractedBrief(JSON.parse(content))
  },
})
