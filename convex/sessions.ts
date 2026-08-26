import { v } from "convex/values"
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { bySpokenTime } from "../src/lib/transcript"
import { parseDebrief } from "../src/lib/debrief"
import { createOpenAI, modelSettings } from "../src/lib/openai"
import { getPack } from "../src/domains/registry"
import type { DomainPack } from "../src/domains/types"
import { ROOM_MS } from "../src/lib/roomClock"
import { IDLE_END_MS, IDLE_PROMPT_MS } from "../src/lib/idleRule"
import {
  debriefValidator,
  endedReasonValidator,
  noteTypeValidator,
  transcriptTypeValidator,
  type EndedReason,
} from "./schema"
import { ownedOrNull, requireIdentity } from "./guard"
import { recordUsage } from "./usage"
import { VERDICT_RESTATE_DIRECTIVE } from "../src/lib/ending"

// Same discipline as the audit's per-material budget: a marathon session
// must not blow the context window. The oldest turns are dropped first —
// the verdict weighs how the session ended, not how it opened.
const TRANSCRIPT_CHAR_BUDGET = 60_000
const TOPIC_CHARS = 60
// Boundary clamp on stored turns: real speech finals run well under 1k
// chars, so only a hostile client ever hits this — it bounds document
// growth, it doesn't shape normal sessions.
const TRANSCRIPT_ENTRY_CHARS = 4000
// The five minute clock makes 240 entries a generous ceiling; past it, a
// hostile or wedged client is padding toward the document size limit, not
// transcribing speech.
const MAX_TRANSCRIPT_ENTRIES = 240
// Transcription finals land AFTER the room concludes by design (the landing
// chain holds for the transcript tail), so a concluded session keeps taking
// writes for this long past endedAt — then the record closes.
const LATE_WRITE_GRACE_MS = 15_000

// Persona text comes from the pack and the Runway avatar id from the
// registry, so neither can be injected. Only the session-relevant slice of
// the persona is stored — the pack carries UI-only fields (image, attack,
// bio, tags) that would fail the schema. Shared by sessions.create and
// practices.continueSession.
export const insertSessionForPersona = async (
  ctx: MutationCtx,
  practiceId: Id<"practices">,
  userId: string,
  pack: DomainPack,
  personaId: string
): Promise<Id<"sessions">> => {
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) throw new Error("Unknown persona")
  const avatar = await ctx.db
    .query("avatars")
    .withIndex("by_pack_persona", (q) => q.eq("packId", pack.id).eq("personaId", persona.id))
    .first()
  if (!avatar) throw new Error("No avatar registered for this panelist")
  const sessionId = await ctx.db.insert("sessions", {
    practiceId,
    userId,
    persona: {
      id: persona.id,
      archetypeId: persona.archetypeId,
      name: persona.name,
      role: persona.role,
      tone: persona.tone,
      avatarId: avatar.runwayAvatarId,
    },
    transcript: [],
    liveNotes: [],
    status: "live",
  })
  // Rollup sync for practices.list: this is the only sessions insert site,
  // so counting here keeps the denormalized fields truthful by construction.
  const practice = await ctx.db.get(practiceId)
  if (practice) {
    await ctx.db.patch(practiceId, {
      sessionCount: (practice.sessionCount ?? 0) + 1,
      lastSessionAt: Date.now(),
    })
  }
  return sessionId
}

export const create = mutation({
  args: { practiceId: v.id("practices"), personaId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) throw new Error("Practice not found")
    // A still-live session is the one to return to — rejoin it rather than
    // minting a parallel one (and a second billable avatar session).
    const live = await ctx.db
      .query("sessions")
      .withIndex("by_practice_status", (q) =>
        q.eq("practiceId", args.practiceId).eq("status", "live")
      )
      .first()
    if (live) return live._id
    const sessionId = await insertSessionForPersona(
      ctx,
      args.practiceId,
      identity.subject,
      getPack(practice.packId),
      args.personaId
    )
    // The practice remembers who it's with; the next session defaults to
    // the same persona.
    if (practice.personaId !== args.personaId) {
      await ctx.db.patch(args.practiceId, { personaId: args.personaId })
    }
    return sessionId
  },
})

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return ownedOrNull(identity, await ctx.db.get(args.id))
  },
})

// Newest first; the practice detail's session list.
export const listByPractice = query({
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) return []
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.practiceId))
      .collect()
    sessions.sort((a, b) => b._creationTime - a._creationTime)
    return sessions.map((session) => ({
      sessionId: session._id,
      status: session.status,
      startedAt: session._creationTime,
      endedAt: session.endedAt ?? null,
      turns: session.transcript.length,
      userTurns: session.transcript.filter((e) => e.type === "user").length,
      panelistTurns: session.transcript.filter((e) => e.type === "panelist").length,
      personaName: session.persona.name,
      title: session.debrief?.title ?? null,
      verdict: session.debrief?.verdict ?? null,
      quote: session.debrief?.spokenVerdict.text ?? null,
    }))
  },
})

export const getLive = query({
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) return null
    return await ctx.db
      .query("sessions")
      .withIndex("by_practice_status", (q) =>
        q.eq("practiceId", args.practiceId).eq("status", "live")
      )
      .first()
  },
})

export const addTranscriptEntry = mutation({
  args: {
    id: v.id("sessions"),
    entry: v.object({
      speaker: v.string(),
      speakerName: v.string(),
      text: v.string(),
      timestamp: v.number(),
      spokenAt: v.optional(v.number()),
      // Everything downstream branches "user vs panelist", so an unknown
      // type would be silently attributed to the panelist. The validator is
      // the boundary — this is a public mutation.
      type: transcriptTypeValidator,
    }),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!session) throw new Error("Session not found")

    // A concluded room takes no more turns once the transcript-tail grace
    // has passed, and the entry ceiling bounds what a wedged or hostile
    // client can pad into the document either way.
    if (
      session.status !== "live" &&
      Date.now() - (session.endedAt ?? 0) > LATE_WRITE_GRACE_MS
    ) {
      return { written: false }
    }
    if (session.transcript.length >= MAX_TRANSCRIPT_ENTRIES) return { written: false }

    // The avatar echoes back user lines (and vice versa) within a beat;
    // a verbatim repeat inside 30s is noise, not a turn.
    const normalized = args.entry.text.trim().toLowerCase()
    const recent = session.transcript.slice(-4)
    const opposite = args.entry.type === "panelist" ? "user" : "panelist"
    const echoes = recent.some(
      (e) =>
        e.type === opposite &&
        e.text.trim().toLowerCase() === normalized &&
        args.entry.timestamp - e.timestamp < 30000
    )
    if (echoes) return { written: false }

    const entry = { ...args.entry, text: args.entry.text.slice(0, TRANSCRIPT_ENTRY_CHARS) }
    await ctx.db.patch(args.id, { transcript: [...session.transcript, entry] })
    return { written: true }
  },
})

// Client end-reason stamps are advisory: endedReason feeds the future quota
// policy (short/error sessions may not count), so the server verifies each
// claim against its own clock and record and downgrades anything it cannot
// corroborate to "user", the neutral reason. "time" needs the room clock
// actually near its end (the slack covers the speech-grace floor landing at
// T minus two seconds); "idle" needs the record actually quiet for the
// prompt-plus-end window; "error" needs a one-sided record — the same
// nothing-on-record rule generateDebrief enforces; "verdict" has had no
// writer since the ending tools were removed, so it downgrades outright.
const TIME_SLACK_MS = 20_000
const IDLE_SLACK_MS = 10_000

const verifiedEndedReason = (
  session: Doc<"sessions">,
  claimed: EndedReason | undefined,
  now: number
): EndedReason => {
  if (claimed === "time") {
    return session.roomStartedAt !== undefined &&
      now - session.roomStartedAt >= ROOM_MS - TIME_SLACK_MS
      ? "time"
      : "user"
  }
  if (claimed === "idle") {
    const lastActivity =
      session.transcript[session.transcript.length - 1]?.timestamp ?? session.roomStartedAt
    return lastActivity !== undefined &&
      now - lastActivity >= IDLE_PROMPT_MS + IDLE_END_MS - IDLE_SLACK_MS
      ? "idle"
      : "user"
  }
  if (claimed === "error") {
    const hasUserTurn = session.transcript.some((e) => e.type === "user")
    const hasPanelistTurn = session.transcript.some((e) => e.type === "panelist")
    return !hasUserTurn || !hasPanelistTurn ? "error" : "user"
  }
  return "user"
}

// Ending takes effect the moment the user clicks, not when the debrief
// finishes generating — getLive stops returning the session immediately,
// so an ended session can never be rejoined while the debrief writes.
export const end = mutation({
  args: { id: v.id("sessions"), reason: v.optional(endedReasonValidator) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!session) throw new Error("Session not found")
    if (session.status === "concluded") return
    const now = Date.now()
    await ctx.db.patch(args.id, {
      status: "concluded",
      endedAt: now,
      endedReason: verifiedEndedReason(session, args.reason, now),
    })
  },
})

// Internal: written only by avatars.mint, which verifies ownership before
// creating the Runway session this records. Public would let any owner
// stamp an arbitrary string and pass the DELETE route's ownership check
// against a Runway session that was never theirs. Latest connect wins —
// retries overwrite.
export const setRunwaySessionId = internalMutation({
  args: { id: v.id("sessions"), runwaySessionId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { runwaySessionId: args.runwaySessionId })
  },
})

// Internal: written only by orchestrator.decide.
// Debounce claim for orchestrator.decide: both transcript bridges fire it
// on every written entry, and entries land in bursts. One look per window
// is enough — the model reads the last 12 turns regardless — so claims
// inside the window skip the model call entirely. Atomic check-and-stamp:
// concurrent claims serialize in the mutation.
const ORCHESTRATE_WINDOW_MS = 8_000

export const claimOrchestrate = internalMutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session || session.status !== "live") return false
    const now = Date.now()
    if (
      session.lastOrchestratedAt !== undefined &&
      now - session.lastOrchestratedAt < ORCHESTRATE_WINDOW_MS
    ) {
      return false
    }
    await ctx.db.patch(args.id, { lastOrchestratedAt: now })
    return true
  },
})

export const addLiveNote = internalMutation({
  args: {
    id: v.id("sessions"),
    note: v.object({ type: noteTypeValidator, text: v.string() }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session) throw new Error("Session not found")
    await ctx.db.patch(args.id, {
      liveNotes: [...session.liveNotes, { ...args.note, timestamp: Date.now() }],
    })
  },
})

// Internal: written only by orchestrator.decide.
export const setTopic = internalMutation({
  args: { id: v.id("sessions"), topic: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { currentTopic: args.topic.slice(0, TOPIC_CHARS) })
  },
})

// Spend slot for the debrief: generation is a paid quality-tier model call,
// so concurrent generateDebrief calls (the landing chain plus a report-page
// retry) collapse to one. Same shape as claimRead/claimOrchestrate: atomic
// check-and-stamp, TTL so a crashed generation's claim expires and retry
// still works. The TTL must outlive the slowest real generation (observed
// well under a minute) but no more: the report page offers its retry at
// thirty seconds, and every second past the TTL floor is a silent no-op
// click for a user whose generation crashed. Internal: taken only by
// sessions.generateDebrief.
const DEBRIEF_CLAIM_TTL_MS = 60_000

export const claimDebrief = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.debrief || session.status !== "concluded") return false
    const now = Date.now()
    if (
      session.debriefClaimedAt !== undefined &&
      now - session.debriefClaimedAt < DEBRIEF_CLAIM_TTL_MS
    ) {
      return false
    }
    await ctx.db.patch(args.sessionId, { debriefClaimedAt: now })
    return true
  },
})

// Internal: the debrief write claims the session — patch-if-absent, so two
// concurrent generations produce one debrief and one conclusion.
export const setDebrief = internalMutation({
  args: { id: v.id("sessions"), debrief: debriefValidator },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session) throw new Error("Session not found")
    if (session.debrief) return { created: false }
    await ctx.db.patch(args.id, {
      debrief: args.debrief,
      status: "concluded",
      endedAt: session.endedAt ?? Date.now(),
    })
    // Rollup sync for practices.list. Debriefs usually land in session
    // order, but a retried older session (generation crashed, user retries
    // from its report page after a newer session was debriefed) writes out
    // of order — the stamp guard keeps the rollup on the newest debriefed
    // session, matching what the old collect computed.
    const practice = await ctx.db.get(session.practiceId)
    if (practice && session._creationTime >= (practice.lastVerdictSessionAt ?? 0)) {
      await ctx.db.patch(session.practiceId, {
        lastVerdict: args.debrief.verdict,
        lastQuote: args.debrief.spokenVerdict.text,
        lastVerdictSessionAt: session._creationTime,
      })
    }
    return { created: true }
  },
})

export const generateDebrief = action({
  args: { sessionId: v.id("sessions") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (generateDebrief → api → generateDebrief), which otherwise fails
  // `next build` typechecking.
  handler: async (ctx, args): Promise<{ sessionId: Id<"sessions"> }> => {
    await requireIdentity(ctx)
    // api.sessions.get is ownership-scoped, so a session the caller doesn't
    // own reads as missing here.
    const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId })
    if (!session) throw new Error("Session not found")
    if (session.debrief) return { sessionId: args.sessionId }

    // Full practice, sealed blueprint fields included: the debrief prompt
    // judges against the rubric. Server-only read, reached through the
    // ownership-scoped session above — practiceId comes from the owned
    // session document, never from client args.
    const practice = await ctx.runQuery(internal.practices.getFull, {
      id: session.practiceId,
    })
    if (!practice) throw new Error("Practice not found")

    const pack = getPack(practice.packId)
    const persona = session.persona

    const userTurns = session.transcript
      .filter((e) => e.type === "user")
      .map((e) => e.text)
    // A debrief of a session the user never spoke in can only hallucinate;
    // the report page renders the nothing-to-debrief state instead.
    if (userTurns.length === 0) return { sessionId: args.sessionId }
    // No interviewer on the record means no interview happened; a debrief
    // could only hallucinate from whatever the mic picked up instead.
    const panelistTurns = session.transcript.filter((e) => e.type === "panelist")
    if (panelistTurns.length === 0) return { sessionId: args.sessionId }

    // Spend slot: a refused claim means another generation is already on it
    // (or just finished) — return the same benign shape the debrief-exists
    // early-return does and let the report page's live query pick it up.
    const claimed = await ctx.runMutation(internal.sessions.claimDebrief, {
      sessionId: args.sessionId,
    })
    if (!claimed) return { sessionId: args.sessionId }

    const fullTranscript =
      session.transcript.length > 0
        ? bySpokenTime(session.transcript)
            .map((e) =>
              e.type === "user"
                ? `${pack.userLabel}: ${e.text}`
                : `${persona.name.toUpperCase()}: ${e.text}`
            )
            .join("\n")
        : "(No conversation was captured.)"
    const transcript =
      fullTranscript.length > TRANSCRIPT_CHAR_BUDGET
        ? `(earlier turns omitted)\n${fullTranscript.slice(-TRANSCRIPT_CHAR_BUDGET)}`
        : fullTranscript

    const notes =
      session.liveNotes.length > 0
        ? session.liveNotes
            .slice(-10)
            .map((n) => `[${n.type}] ${n.text}`)
            .join("\n")
        : "(none)"

    const priorContinuity = practice.continuity ?? null

    const openai = await createOpenAI()
    const settings = modelSettings("quality")

    const response = await openai.chat.completions.create({
      ...settings,
      messages: [
        {
          role: "system",
          content:
            pack.prompts.debrief({
              scope: practice.scope,
              characterName: persona.name,
              characterRole: persona.role,
              characterTone: persona.tone,
              notes,
              transcript,
              continuity: priorContinuity
                ? {
                    summary: priorContinuity.lastSessionSummary,
                    open: priorContinuity.actionItems
                      .filter((item) => item.status === "open")
                      .map((item) => item.text),
                    delivered: priorContinuity.actionItems
                      .filter((item) => item.status === "done")
                      .map((item) => item.text),
                  }
                : null,
              blueprint: practice.blueprint
                ? {
                    rubric: practice.blueprint.rubric,
                    verifyTopics: practice.blueprint.verifyTopics,
                  }
                : null,
            }) + VERDICT_RESTATE_DIRECTIVE,
        },
      ],
      response_format: { type: "json_object" },
    })

    await recordUsage(ctx, {
      userId: session.userId,
      kind: "debrief",
      practiceId: session.practiceId,
      sessionId: args.sessionId,
      model: settings.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Empty response from debrief generator")

    const parsed = parseDebrief(JSON.parse(content), {
      verdictValues: pack.verdicts.options.map((option) => option.value),
      fallbackVerdict: pack.verdicts.fallback,
      lowestVerdict:
        pack.verdicts.options.find((option) => option.tone === "bad")?.value ??
        pack.verdicts.fallback,
      userTurns,
    })

    const { created } = await ctx.runMutation(internal.sessions.setDebrief, {
      id: args.sessionId,
      debrief: {
        title: parsed.title,
        verdict: parsed.verdict,
        verdictSummary: parsed.verdictSummary,
        spokenVerdict: {
          speakerId: persona.id,
          speakerName: persona.name,
          text: parsed.spokenVerdict,
        },
        whatHappened: parsed.whatHappened,
        heldUp: parsed.heldUp,
        didntHold: parsed.didntHold,
        ...(parsed.verifyItems.length > 0 ? { verifyItems: parsed.verifyItems } : {}),
      },
    })

    // Continuity is gated on the debrief write: a concurrent generation
    // that lost the race must not double-record commitments.
    if (created && (parsed.continuity.summary || parsed.continuity.actionItems.length > 0)) {
      await ctx.runMutation(internal.practices.recordContinuity, {
        practiceId: session.practiceId,
        sessionId: args.sessionId,
        summary: parsed.continuity.summary,
        actionItems: parsed.continuity.actionItems,
      })
    }

    return { sessionId: args.sessionId }
  },
})
