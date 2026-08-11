import { v } from "convex/values"
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { bySpokenTime } from "../src/lib/transcript"
import { parseDebrief } from "../src/lib/debrief"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { getPack } from "../src/domains/registry"
import type { DomainPack } from "../src/domains/types"
import { debriefValidator, noteTypeValidator, transcriptTypeValidator } from "./schema"
import { ownedOrNull, requireIdentity } from "./guard"

// Same discipline as the audit's per-material budget: a marathon session
// must not blow the context window. The oldest turns are dropped first —
// the verdict weighs how the session ended, not how it opened.
const TRANSCRIPT_CHAR_BUDGET = 60_000
const TOPIC_CHARS = 60
// Boundary clamp on stored turns: real speech finals run well under 1k
// chars, so only a hostile client ever hits this — it bounds document
// growth, it doesn't shape normal sessions.
const TRANSCRIPT_ENTRY_CHARS = 4000

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
  return await ctx.db.insert("sessions", {
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

// Ending takes effect the moment the user clicks, not when the debrief
// finishes generating — getLive stops returning the session immediately,
// so an ended session can never be rejoined while the debrief writes.
export const end = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!session) throw new Error("Session not found")
    if (session.status === "concluded") return
    await ctx.db.patch(args.id, { status: "concluded", endedAt: Date.now() })
  },
})

// Internal: written only by orchestrator.decide.
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

    const practice = await ctx.runQuery(api.practices.get, { id: session.practiceId })
    if (!practice) throw new Error("Practice not found")

    const pack = getPack(practice.packId)
    const persona = session.persona

    const userTurns = session.transcript
      .filter((e) => e.type === "user")
      .map((e) => e.text)
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
    const model = resolveModel("quality")

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: pack.prompts.debrief({
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
          }),
        },
      ],
      response_format: { type: "json_object" },
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
