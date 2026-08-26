import { v } from "convex/values"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { claimValidator, gapValidator, groundAudit } from "../src/lib/audit"
import type { Blueprint } from "../src/lib/blueprint"
import { materialFileType, validateMaterialFile } from "../src/lib/materials"
import { parseExtractedScope } from "../src/lib/intake"
import { createOpenAI, modelSettings } from "../src/lib/openai"
import { getPack, isPackId } from "../src/domains/registry"
import { scopeText, type Scope } from "../src/domains/types"
import { priorityValidator } from "./schema"
import { insertSessionForPersona } from "./sessions"
import { ownedOrNull, requireIdentity } from "./guard"
import { recordUsage } from "./usage"

const MULTI_MAX_ITEMS = 8
const MULTI_ITEM_CHARS = 80
const TEXT_FALLBACK_CHARS = 60
const MAX_OPEN_ITEMS = 10
const MAX_TOTAL_ITEMS = 30
const AUDIT_PROMPT_CHAR_BUDGET = 60_000

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

    const name = scopeText(scope, pack.subjectField)
    if (name.length === 0) throw new Error("Missing a name for this practice")

    // Every create is a new thread on purpose — "CourtTime · gym pilot" and
    // "CourtTime · school district" are different practices even when the
    // product is the same.
    const practiceId = await ctx.db.insert("practices", {
      userId: identity.subject,
      name,
      packId: pack.id,
      status: "draft",
      scope,
    })

    for (const upload of args.materials ?? []) {
      // The client validates before uploading; anything invalid here is a
      // bypass, so reject loudly rather than ingest it.
      const fileType = materialFileType(upload.name)
      if (fileType === null || validateMaterialFile(upload.name, upload.size) !== null) {
        throw new Error(`Unsupported material: ${upload.name}`)
      }
      const materialId = await ctx.db.insert("materials", {
        practiceId,
        storageId: upload.storageId,
        name: upload.name,
        fileType,
        size: upload.size,
        status: "extracting",
      })
      await ctx.scheduler.runAfter(0, internal.ingest.extract, { materialId })
    }

    // No materials means nothing triggers the prep stage until the user
    // reaches its page — start it now so it runs while they confirm and
    // read. (With materials, ingest.extract schedules it when the last one
    // settles; the claim mutations collapse any double trigger.)
    if ((args.materials ?? []).length === 0) {
      await ctx.scheduler.runAfter(
        0,
        pack.prep.kind === "blueprint"
          ? internal.blueprints.runInternal
          : internal.practices.runAuditInternal,
        { id: practiceId }
      )
    }

    return practiceId
  },
})

// Claim slot for the read: concurrent analyze calls (kick-off plus retry
// clicks) collapse to one paid model call. The TTL lets a claim from a
// crashed action expire so retry still works; a completed read (context
// present) never re-runs — a new brief is a new practice.
const READ_CLAIM_TTL_MS = 60_000

export const claimRead = internalMutation({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice || practice.context) return false
    const now = Date.now()
    const held =
      practice.status === "shaping" &&
      practice.readClaimedAt !== undefined &&
      now - practice.readClaimedAt < READ_CLAIM_TTL_MS
    if (held) return false
    await ctx.db.patch(args.id, { status: "shaping", readClaimedAt: now })
    return true
  },
})

// The blueprint's interview intel — questionPlan, rubric, verifyTopics,
// candidateHooks — is sealed: it all feeds the persona briefing, no client
// component renders any of it, and any public function that returns it is
// client-callable and therefore a leak. The client copy of the practice
// carries only what the prep screens show — the fields are picked, not
// spread, and the return type drops the rest so no caller can quietly grow
// a dependency. Server-side consumers use internal.practices.getFull.
type RedactedBlueprint = Omit<
  Blueprint,
  "questionPlan" | "rubric" | "verifyTopics" | "candidateHooks"
>
type RedactedPractice = Omit<Doc<"practices">, "blueprint"> & {
  blueprint?: RedactedBlueprint
}

const redactBlueprint = (blueprint: Blueprint): RedactedBlueprint => ({
  status: blueprint.status,
  themes: blueprint.themes,
  clarifyingQuestions: blueprint.clarifyingQuestions,
  ...(blueprint.refinement !== undefined ? { refinement: blueprint.refinement } : {}),
  ...(blueprint.failureMessage !== undefined
    ? { failureMessage: blueprint.failureMessage }
    : {}),
})

export const get = query({
  args: { id: v.id("practices") },
  handler: async (ctx, args): Promise<RedactedPractice | null> => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) return null
    const { blueprint, ...rest } = practice
    return blueprint ? { ...rest, blueprint: redactBlueprint(blueprint) } : rest
  },
})

// The whole practice document, sealed blueprint fields included. Internal =
// server-only: this is the ONLY path on which questionPlan and rubric exist;
// its callers (sessions.generateDebrief, avatars.mint) reach the practice
// through an ownership-scoped session read first.
export const getFull = internalQuery({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Everything the sidebar, Home grid, and resume hero need, one query.
// Session-derived values come from the rollup fields denormalized at the
// single writer sites (session insert, setDebrief) — collecting every
// session's full transcript here made this the heaviest query in the app.
// hasLive stays a query: liveness is transient state no counter should own,
// and the indexed .first() reads one document at most.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const practices = await ctx.db
      .query("practices")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect()
    const rows = await Promise.all(
      practices.map(async (practice) => {
        const live = await ctx.db
          .query("sessions")
          .withIndex("by_practice_status", (q) =>
            q.eq("practiceId", practice._id).eq("status", "live")
          )
          .first()
        const actionItems = practice.continuity?.actionItems ?? []
        const openItems = actionItems.filter((item) => item.status === "open").length
        return {
          practiceId: practice._id,
          name: practice.name,
          packId: practice.packId,
          personaId: practice.personaId ?? null,
          pinned: practice.pinned ?? false,
          status: practice.status,
          sessionCount: practice.sessionCount ?? 0,
          hasLive: live !== null,
          openItems,
          // Distinguishes "cleared the list" (✓ badge) from "never had one".
          hasActionItems: actionItems.length > 0,
          lastSessionAt: practice.lastSessionAt ?? null,
          lastActivityAt: practice.lastSessionAt ?? practice._creationTime,
          lastVerdict: practice.lastVerdict ?? null,
          lastQuote: practice.lastQuote ?? null,
        }
      })
    )
    // Pinned first, then recency within each group.
    return rows.sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.lastActivityAt - a.lastActivityAt
    )
  },
})

// One-time backfill for the rollup fields on pre-existing practices; new
// rows are kept in sync at the writer sites. Developer-run, once, after
// deploy:
//   npx convex run practices:backfillRollups '{}'
export const backfillRollups = internalMutation({
  args: {},
  handler: async (ctx) => {
    const practices = await ctx.db.query("practices").collect()
    for (const practice of practices) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_practice", (q) => q.eq("practiceId", practice._id))
        .collect()
      sessions.sort((a, b) => b._creationTime - a._creationTime)
      const latest = sessions[0]
      const latestDebriefed = sessions.find((session) => session.debrief)
      await ctx.db.patch(practice._id, {
        sessionCount: sessions.length,
        ...(latest ? { lastSessionAt: latest._creationTime } : {}),
        ...(latestDebriefed?.debrief
          ? {
              lastVerdict: latestDebriefed.debrief.verdict,
              lastQuote: latestDebriefed.debrief.spokenVerdict.text,
              lastVerdictSessionAt: latestDebriefed._creationTime,
            }
          : {}),
      })
    }
  },
})

export const setPinned = mutation({
  args: { id: v.id("practices"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    await ctx.db.patch(args.id, { pinned: args.pinned })
  },
})

// Deleting a practice takes the whole thread with it: sessions, uploaded
// materials and their stored files, then the practice row. The client
// always confirms before calling this.
export const remove = mutation({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.id))
      .collect()
    for (const session of sessions) await ctx.db.delete(session._id)
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.id))
      .collect()
    for (const material of materials) {
      await ctx.storage.delete(material.storageId)
      await ctx.db.delete(material._id)
    }
    await ctx.db.delete(args.id)
  },
})

// The returning-user path: one click from Home or the practice header back
// into the room. A still-live session is rejoined rather than duplicated
// (and double-billed); otherwise a fresh session starts with the practice's
// persona — the continuity briefing carries the memory. No persona yet
// means the caller routes to the meet step instead.
export const continueSession = mutation({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    const live = await ctx.db
      .query("sessions")
      .withIndex("by_practice_status", (q) =>
        q.eq("practiceId", args.id).eq("status", "live")
      )
      .first()
    if (live) return { sessionId: live._id }
    if (!practice.personaId || practice.status !== "ready") return { sessionId: null }
    const sessionId = await insertSessionForPersona(
      ctx,
      args.id,
      identity.subject,
      getPack(practice.packId),
      practice.personaId
    )
    return { sessionId }
  },
})

// Chosen at the meet step; sessions snapshot the full persona at create.
export const setPersona = mutation({
  args: { id: v.id("practices"), personaId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!practice) throw new Error("Practice not found")
    const pack = getPack(practice.packId)
    if (!pack.personas.some((persona) => persona.id === args.personaId)) {
      throw new Error("Unknown persona")
    }
    await ctx.db.patch(args.id, { personaId: args.personaId })
  },
})

// Internal: status transitions are driven by practices.analyze, never the
// client.
export const setStatus = internalMutation({
  args: {
    id: v.id("practices"),
    status: v.union(v.literal("draft"), v.literal("shaping"), v.literal("ready")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status })
  },
})

// Internal: written only by practices.analyze, which filters the model
// output to the pack's contextFields before calling.
export const setContext = internalMutation({
  args: {
    id: v.id("practices"),
    context: v.record(v.string(), v.string()),
    status: v.union(v.literal("draft"), v.literal("shaping"), v.literal("ready")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { context: args.context, status: args.status })
  },
})

export const analyze = action({
  args: { id: v.id("practices") },
  handler: async (ctx, args): Promise<Record<string, string> | null> => {
    await requireIdentity(ctx)
    const practice = await ctx.runQuery(api.practices.get, { id: args.id })
    if (!practice) throw new Error("Practice not found")

    const claimed = await ctx.runMutation(internal.practices.claimRead, { id: args.id })
    if (!claimed) return null

    try {
      const openai = await createOpenAI()
      const settings = modelSettings("fast")
      const pack = getPack(practice.packId)

      const response = await openai.chat.completions.create({
        ...settings,
        messages: [
          { role: "system", content: pack.prompts.analyzeSystem },
          { role: "user", content: pack.prompts.analyzeUser(practice.scope) },
        ],
        response_format: { type: "json_object" },
      })

      await recordUsage(ctx, {
        userId: practice.userId,
        kind: "analyze",
        practiceId: args.id,
        model: settings.model,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error("No response from OpenAI")

      // Hold the model to the pack's contract: every declared field, nothing
      // extra stored. The prompts say "each field is a string", but the fast
      // model returns plural fields (openQuestions) as arrays often enough
      // that an array of strings must read as valid — joined, not fatal.
      const parsed = JSON.parse(content) as Record<string, unknown>
      const context: Record<string, string> = {}
      for (const field of pack.contextFields) {
        const value = parsed[field.key]
        if (typeof value === "string") {
          context[field.key] = value
        } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
          context[field.key] = value.join("\n")
        } else {
          throw new Error(`Analysis missing ${field.key}`)
        }
      }

      await ctx.runMutation(internal.practices.setContext, {
        id: args.id,
        context,
        status: "ready",
      })

      return context
    } catch (error) {
      // Practices have no failed state, so a thrown analysis must not
      // strand the doc in "shaping" forever — revert to draft and let the
      // wait screen's retry run it again.
      await ctx.runMutation(internal.practices.setStatus, { id: args.id, status: "draft" })
      throw error
    }
  },
})

// Intake extraction: spoken pitch (or deck text) → honest partial scope,
// keyed by the lane's scope fields. No reads, no writes; the user reviews
// and fills gaps before anything is created. An absent key means the
// speaker never said it.
export const extractScope = action({
  args: {
    packId: v.string(),
    pitch: v.string(),
    source: v.union(v.literal("voice"), v.literal("deck")),
  },
  handler: async (ctx, args): Promise<Scope> => {
    const identity = await requireIdentity(ctx)
    if (!isPackId(args.packId)) throw new Error("Unknown lane")
    const pack = getPack(args.packId)
    const openai = await createOpenAI()
    const settings = modelSettings("fast")

    const response = await openai.chat.completions.create({
      ...settings,
      messages: [
        {
          role: "system",
          content: pack.prompts.extractScope({ source: args.source, pitch: args.pitch }),
        },
      ],
      response_format: { type: "json_object" },
    })

    await recordUsage(ctx, {
      userId: identity.subject,
      kind: "extract_scope",
      model: settings.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Extraction returned nothing")
    return parseExtractedScope(JSON.parse(content), pack.scopeFields)
  },
})

/* ---------- Pre-session audit (the "still unproven" gap map) ---------- */

// Claims a run slot on the embedded audit field. Returns false when an
// audit is already running — or ready, unless force — so concurrent
// triggers collapse to one run.
export const claimAudit = internalMutation({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return false
    const existing = practice.audit
    if (existing) {
      if (existing.status === "running") return false
      if (existing.status === "ready" && !args.force) return false
      // Keep the previous claims and gaps until the new outcome lands: a
      // forced re-run that fails must not have destroyed the last good map.
      await ctx.db.patch(args.id, {
        audit: { ...existing, status: "running", failureReason: undefined },
      })
      return true
    }
    await ctx.db.patch(args.id, {
      audit: { status: "running", claims: [], gaps: [] },
    })
    return true
  },
})

export const auditInputs = internalQuery({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.id))
      .collect()
    return {
      practice,
      readable: materials.flatMap((material) =>
        material.status === "ready" && material.text
          ? [{ name: material.name, text: material.text }]
          : []
      ),
      unreadableCount: materials.filter((material) => material.status === "failed").length,
    }
  },
})

// Which prep stage this practice's lane runs — lets the scheduler and the
// audit pipeline stay off blueprint-lane practices (and vice versa).
export const prepKind = internalQuery({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    return practice ? getPack(practice.packId).prep.kind : null
  },
})

export const setAuditOutcome = internalMutation({
  args: {
    id: v.id("practices"),
    outcome: v.union(
      v.object({
        status: v.literal("ready"),
        claims: v.array(claimValidator),
        gaps: v.array(gapValidator),
      }),
      v.object({ status: v.literal("failed"), failureReason: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return
    const previous = practice.audit ?? { claims: [], gaps: [] }
    await ctx.db.patch(args.id, {
      audit:
        args.outcome.status === "ready"
          ? { status: "ready", claims: args.outcome.claims, gaps: args.outcome.gaps }
          : {
              status: "failed",
              claims: previous.claims,
              gaps: previous.gaps,
              failureReason: args.outcome.failureReason,
            },
    })
  },
})

const generateAudit = async (
  ctx: ActionCtx,
  args: { id: Id<"practices">; force?: boolean }
): Promise<void> => {
  // Materials still extracting: don't run a materials-blind audit that
  // would then block the corrective re-run. The last extraction to settle
  // re-triggers this, so declining here loses nothing.
  const settled = await ctx.runQuery(internal.materials.allSettled, { practiceId: args.id })
  if (!settled) return

  // A blueprint-pack practice must never grow an audit field — the claim
  // itself would write one.
  const kind = await ctx.runQuery(internal.practices.prepKind, { id: args.id })
  if (kind !== "audit") return

  const claimed = await ctx.runMutation(internal.practices.claimAudit, {
    id: args.id,
    force: args.force,
  })
  if (!claimed) return

  const fail = (failureReason: string) =>
    ctx.runMutation(internal.practices.setAuditOutcome, {
      id: args.id,
      outcome: { status: "failed", failureReason },
    })

  try {
    const { practice, readable, unreadableCount } = await ctx.runQuery(
      internal.practices.auditInputs,
      { id: args.id }
    )
    if (!practice) {
      await fail("Practice not found.")
      return
    }

    const perMaterialBudget =
      readable.length > 0 ? Math.floor(AUDIT_PROMPT_CHAR_BUDGET / readable.length) : 0
    const materialSections =
      readable.length > 0
        ? readable
            .map(
              (material) =>
                `=== ${material.name} ===\n${material.text.slice(0, perMaterialBudget)}`
            )
            .join("\n\n")
        : "(No readable materials were provided.)"

    const openai = await createOpenAI()
    const settings = modelSettings("quality")
    const pack = getPack(practice.packId)
    if (pack.prep.kind !== "audit") {
      await fail("This practice doesn't use the audit stage.")
      return
    }
    const auditPrompt = pack.prep.prompt

    const response = await openai.chat.completions.create({
      ...settings,
      messages: [
        {
          role: "system",
          content: auditPrompt({
            scope: practice.scope,
            unreadableCount,
            materialSections,
          }),
        },
      ],
      response_format: { type: "json_object" },
    })

    await recordUsage(ctx, {
      userId: practice.userId,
      kind: "audit",
      practiceId: args.id,
      model: settings.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      await fail("The audit model returned nothing. Try again.")
      return
    }

    const { claims, gaps } = groundAudit(JSON.parse(content), readable)
    await ctx.runMutation(internal.practices.setAuditOutcome, {
      id: args.id,
      outcome: { status: "ready", claims, gaps },
    })
  } catch (error) {
    // Fixed message only: failureReason is client-readable, and provider
    // error text can carry key fragments and org details. Raw error goes
    // to the server log.
    console.error("[practices.runAudit]", error)
    await fail("The audit hit an error. Re-run it to try again.")
  }
}

// No public force: a ready audit can't be client-regenerated in a loop
// (metered model spend) — same discipline as blueprints.run. Forced re-runs
// go through runAuditInternal via the CLI.
export const runAudit = action({
  args: { id: v.id("practices") },
  handler: async (ctx, args): Promise<void> => {
    await requireIdentity(ctx)
    // api.practices.get is ownership-scoped: someone else's practice reads
    // as missing, and no model call is spent on it.
    const practice = await ctx.runQuery(api.practices.get, { id: args.id })
    if (!practice) return
    await generateAudit(ctx, { id: args.id })
  },
})

// Scheduler entry: ingest.extract fires this when the last material
// settles. The scheduler runs with no user identity, so it can't go through
// the public, guarded path.
export const runAuditInternal = internalAction({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: generateAudit,
})

/* ---------- Continuity (the working list) ---------- */

// Internal: written only by sessions.generateDebrief after the winning
// debrief write. New items fill the remaining open slots; settled history
// is kept newest-first up to the total cap so the array stays bounded.
export const recordContinuity = internalMutation({
  args: {
    practiceId: v.id("practices"),
    sessionId: v.id("sessions"),
    summary: v.string(),
    actionItems: v.array(v.object({ text: v.string(), priority: priorityValidator })),
  },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.practiceId)
    if (!practice) return
    const existing = practice.continuity?.actionItems ?? []
    const open = existing.filter((item) => item.status === "open")
    const now = Date.now()
    // The debrief prompt is told not to re-emit tracked commitments; this is
    // the server-side backstop for when it does anyway.
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
    const tracked = new Set(existing.map((item) => normalize(item.text)))
    const fresh = args.actionItems
      .filter((item) => !tracked.has(normalize(item.text)))
      .slice(0, Math.max(0, MAX_OPEN_ITEMS - open.length))
      .map((item, i) => ({
        id: `${args.sessionId}:${i}`,
        text: item.text,
        priority: item.priority,
        status: "open" as const,
        fromSessionId: args.sessionId,
        createdAt: now,
      }))
    const settled = existing
      .filter((item) => item.status !== "open")
      .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))
      .slice(0, Math.max(0, MAX_TOTAL_ITEMS - open.length - fresh.length))
    await ctx.db.patch(args.practiceId, {
      continuity: {
        lastSessionSummary: args.summary || practice.continuity?.lastSessionSummary || "",
        actionItems: [...open, ...fresh, ...settled],
        updatedAt: now,
      },
    })
  },
})

// The user settling their own commitment — or undoing a mis-click. Legal
// transitions: open → done/dropped, and done/dropped → open (reopen). An
// unknown, unowned, or same-state item reads as missing.
export const setActionItemStatus = mutation({
  args: {
    practiceId: v.id("practices"),
    itemId: v.string(),
    status: v.union(v.literal("done"), v.literal("dropped"), v.literal("open")),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice?.continuity) throw new Error("Not found")
    const target = practice.continuity.actionItems.find((item) => item.id === args.itemId)
    const legal =
      args.status === "open" ? target && target.status !== "open" : target?.status === "open"
    if (!target || !legal) throw new Error("Not found")
    await ctx.db.patch(args.practiceId, {
      continuity: {
        ...practice.continuity,
        actionItems: practice.continuity.actionItems.map((item) =>
          item.id === args.itemId
            ? {
                ...item,
                status: args.status,
                settledAt: args.status === "open" ? undefined : Date.now(),
              }
            : item
        ),
        updatedAt: Date.now(),
      },
    })
  },
})
