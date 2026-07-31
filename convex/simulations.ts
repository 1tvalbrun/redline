import { v } from "convex/values"
import { internalMutation, mutation, query, action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { materialFileType, validateMaterialFile } from "../src/lib/materials"
import { FREE_TEXT_LIMITS, parseExtractedBrief } from "../src/lib/intake"
import {
  BUSINESS_MODEL_OPTIONS,
  STAGE_OPTIONS,
  TARGET_OPTIONS,
} from "../src/lib/briefOptions"

export const create = mutation({
  args: {
    title: v.string(),
    roomType: v.string(),
    brief: v.object({
      ideaName: v.string(),
      stage: v.string(),
      description: v.string(),
      targetUser: v.string(),
      businessModel: v.string(),
      whyNow: v.optional(v.string()),
      focusAreas: v.array(v.string()),
    }),
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
    // Brief fields are interpolated into every downstream prompt, and the
    // UI can be bypassed — hold them to the same sizes the intake extractor
    // enforces before they're stored.
    const brief = {
      ...args.brief,
      ideaName: args.brief.ideaName.trim().slice(0, FREE_TEXT_LIMITS.ideaName),
      description: args.brief.description.trim().slice(0, FREE_TEXT_LIMITS.description),
      whyNow: args.brief.whyNow?.trim().slice(0, FREE_TEXT_LIMITS.whyNow),
      stage: args.brief.stage.trim().slice(0, 60),
      targetUser: args.brief.targetUser.trim().slice(0, 60),
      businessModel: args.brief.businessModel.trim().slice(0, 60),
      focusAreas: args.brief.focusAreas.slice(0, 8).map((area) => area.trim().slice(0, 80)),
    }

    const existingIdea = await ctx.db
      .query("ideas")
      .withIndex("by_name", (q) => q.eq("name", brief.ideaName))
      .first()
    const ideaId =
      existingIdea?._id ?? (await ctx.db.insert("ideas", { name: brief.ideaName }))
    const simulationId = await ctx.db.insert("simulations", {
      title: args.title.trim().slice(0, 120),
      roomType: args.roomType,
      brief,
      ideaId,
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
    return await ctx.db.get(args.id)
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

// Internal: written only by simulations.analyze.
export const setContext = internalMutation({
  args: {
    id: v.id("simulations"),
    context: v.object({
      problem: v.string(),
      targetCustomer: v.string(),
      coreAssumption: v.string(),
      revenueModel: v.string(),
      primaryRisk: v.string(),
      competitors: v.string(),
      openQuestions: v.string(),
    }),
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
    const simulation = await ctx.runQuery(api.simulations.get, { id: args.id })
    if (!simulation) throw new Error("Simulation not found")

    await ctx.runMutation(internal.simulations.setStatus, {
      id: args.id,
      status: "analyzing",
    })

    try {
      const { OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini"

      const brief = simulation.brief
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are a business analyst. Extract structured context from a startup brief. Return JSON only with these fields: problem, targetCustomer, coreAssumption, revenueModel, primaryRisk, competitors, openQuestions. Each field is a string.`,
          },
          {
            role: "user",
            content: `Idea: ${brief.ideaName}\nStage: ${brief.stage}\nDescription: ${brief.description}\nTarget User: ${brief.targetUser}\nBusiness Model: ${brief.businessModel}\nFocus Areas: ${brief.focusAreas.join(", ")}`,
          },
        ],
        response_format: { type: "json_object" },
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error("No response from OpenAI")

      const context = JSON.parse(content)

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
  handler: async (_ctx, args) => {
    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini"

    const stageValues = STAGE_OPTIONS.map((o) => o.value).join(" | ")
    const modelValues = BUSINESS_MODEL_OPTIONS.map((o) => `${o.value} (${o.label})`).join(", ")
    const targetValues = TARGET_OPTIONS.map((o) => `${o.value} (${o.label})`).join(", ")

    const systemPrompt = `You turn a founder's ${args.source === "voice" ? "spoken pitch transcript" : "pitch deck text"} into a structured brief.

THE HONESTY RULE: extract ONLY what the founder actually said. If a field is not clearly present, return null for it. A thin or vague pitch should produce mostly nulls. Never infer, never fill in plausible content, never polish vagueness into specifics.

Fields:
- "ideaName": the product or company name, only if stated.
- "description": what it is and does, 1-3 sentences using the founder's own substance (you may fix grammar, not add facts).
- "whyNow": why this is the moment, only if the founder addressed timing.
- "stage": one of ${stageValues} — only if stated or unmistakable.
- "businessModel": one of these values, only if stated: ${modelValues}.
- "targetUser": one of these values, only if the audience clearly matches one: ${targetValues}.

Return JSON only: {"ideaName","description","whyNow","stage","businessModel","targetUser"} with null for anything not present.

The pitch:
${args.pitch.slice(0, 12_000)}`

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Extraction returned nothing")
    return parseExtractedBrief(JSON.parse(content))
  },
})
