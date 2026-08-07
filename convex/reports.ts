import { v } from "convex/values"
import { action, internalMutation, query } from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { bySpokenTime } from "../src/lib/transcript"
import { selectVerdictSpeaker } from "../src/lib/readiness"
import { groundHeldUp } from "../src/lib/reportGrounding"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { axisKeys, axisOwners, getPack, scopeOf } from "../src/domains/registry"
import { scopeText } from "../src/domains/types"
import { priorityValidator, type Priority } from "./schema"
import { ownedOrNull, requireIdentity } from "./guard"

// Internal: the only caller is reports.generate. Insert-if-absent on the
// by_simulation index so two concurrent generations for one room produce
// one report and one room verdict (conclude is gated on `created`) — the
// guard lives here, on the serializable mutation, not in the action's
// non-transactional check.
export const create = internalMutation({
  args: {
    simulationId: v.id("simulations"),
    roomId: v.id("rooms"),
    userId: v.string(),
    overallScore: v.number(),
    // Pack verdict vocabulary; generate validates before calling.
    verdict: v.string(),
    executiveSummary: v.string(),
    panelVerdicts: v.array(
      v.object({
        characterId: v.string(),
        characterName: v.string(),
        verdict: v.string(),
        score: v.number(),
        reasoning: v.string(),
      })
    ),
    topRisks: v.array(v.string()),
    opportunities: v.array(v.string()),
    nextSevenDays: v.array(
      v.object({
        day: v.number(),
        task: v.string(),
        priority: priorityValidator,
      })
    ),
    spokenVerdict: v.object({
      speakerId: v.string(),
      speakerName: v.string(),
      text: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
    if (existing) return { reportId: existing._id, created: false }
    const reportId = await ctx.db.insert("reports", args)
    return { reportId, created: true }
  },
})

export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const report = await ctx.db
      .query("reports")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
    return ownedOrNull(identity, report)
  },
})

const PRIORITIES = new Set(["high", "medium", "low"])
// Same discipline as the audit's per-material budget: a marathon session
// must not blow the context window. The oldest turns are dropped first —
// the verdict weighs how the session ended, not how it opened.
const TRANSCRIPT_CHAR_BUDGET = 60_000
// Continuity bounds: the summary must fit a briefing section, items must
// read aloud in one breath, and one session may add at most five.
const CONTINUITY_SUMMARY_CHARS = 1200
const ACTION_ITEM_CHARS = 120
const MAX_SESSION_ACTION_ITEMS = 5
const clampInt = (n: unknown, fallback: number) =>
  typeof n === "number" ? Math.max(0, Math.min(100, Math.round(n))) : fallback

export const generate = action({
  args: { roomId: v.id("rooms") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (generate → api → generate), which otherwise fails `next build` typechecking.
  handler: async (ctx, args): Promise<{ reportId: Id<"reports"> }> => {
    await requireIdentity(ctx)
    // api.rooms.get is ownership-scoped, so a room the caller doesn't own
    // reads as missing here.
    const room = await ctx.runQuery(api.rooms.get, { id: args.roomId })
    if (!room) throw new Error("Room not found")

    const existing = await ctx.runQuery(api.reports.getBySimulation, {
      simulationId: room.simulationId,
    })
    if (existing) return { reportId: existing._id }

    const simulation = await ctx.runQuery(api.simulations.get, {
      id: room.simulationId,
    })
    if (!simulation) throw new Error("Simulation not found")

    const character = room.characters[0]
    if (!character) throw new Error("No character in room")

    const pack = getPack(simulation.packId)

    const userTurns = room.transcript
      .filter((e) => e.type === "user")
      .map((e) => e.text)
    const fullTranscript =
      room.transcript.length > 0
        ? bySpokenTime(room.transcript)
            .map((e) =>
              e.type === "user"
                ? `${pack.userLabel}: ${e.text}`
                : `${character.name.toUpperCase()}: ${e.text}`
            )
            .join("\n")
        : "(No conversation was captured.)"
    const transcript =
      fullTranscript.length > TRANSCRIPT_CHAR_BUDGET
        ? `(earlier turns omitted)\n${fullTranscript.slice(-TRANSCRIPT_CHAR_BUDGET)}`
        : fullTranscript

    const notes =
      room.liveNotes.length > 0
        ? room.liveNotes
            .slice(-10)
            .map((n) => `[${n.type}] ${n.text}`)
            .join("\n")
        : "(none)"

    // The engagement's memory going into this session: the report compounds
    // the summary rather than replacing it, and must not re-emit tracked
    // commitments. One bounded point-read; null on a first session.
    const priorContinuity = await ctx.runQuery(api.ideas.continuityForSimulation, {
      simulationId: room.simulationId,
    })

    const openai = await createOpenAI()
    const model = resolveModel("quality")

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: pack.prompts.report({
            scope: scopeOf(simulation),
            characterName: character.name,
            characterRole: character.role,
            characterTone: character.tone,
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
    if (!content) throw new Error("Empty response from report generator")

    const parsed = JSON.parse(content)

    // The pack's verdict vocabulary is the closed set; anything else the
    // model emits falls back to the pack's middle-ground verdict.
    const decisions = new Set(pack.verdicts.options.map((option) => option.value))
    const rawVerdict = parsed.verdict ?? {}
    const decision: string = decisions.has(rawVerdict.decision)
      ? rawVerdict.decision
      : pack.verdicts.fallback
    const verdictSummary =
      typeof rawVerdict.summary === "string"
        ? rawVerdict.summary
        : "Verdict pending review."
    const verdictConfidence = clampInt(rawVerdict.confidence, 50)

    // The one-line verdict the panelist "speaks" — distinct from the
    // written summary. Capped well past the 120-160 target so a rambling
    // model can't bloat the quote.
    const spokenVerdict = (
      typeof parsed.spokenVerdict === "string" && parsed.spokenVerdict.trim().length > 0
        ? parsed.spokenVerdict.trim()
        : `My verdict: ${decision}. ${verdictSummary}`
    ).slice(0, 220)

    const overallScore = clampInt(parsed.overallScore, 50)
    const executiveSummary =
      typeof parsed.executiveSummary === "string" ? parsed.executiveSummary : ""

    const rawPanel = parsed.panelVerdict ?? {}
    const panelVerdicts = [
      {
        characterId: character.id,
        characterName: character.name,
        verdict:
          typeof rawPanel.verdict === "string" ? rawPanel.verdict : decision,
        score: clampInt(rawPanel.score, overallScore),
        reasoning:
          typeof rawPanel.reasoning === "string" ? rawPanel.reasoning : "",
      },
    ]

    const topRisks = Array.isArray(parsed.topRisks)
      ? parsed.topRisks.filter((r: unknown) => typeof r === "string").slice(0, 5)
      : []
    // "Held up" is grounded like audit claims: a finding the user can't
    // be quoted on is dropped, and zero survivors is a legitimate report.
    const heldUp = groundHeldUp(parsed.heldUp, userTurns)
    const proposed = Array.isArray(parsed.heldUp) ? parsed.heldUp.length : 0
    if (proposed > heldUp.length) {
      console.warn(
        `[reports.generate] dropped ${proposed - heldUp.length} ungrounded heldUp finding(s)`
      )
    }
    const opportunities = heldUp.map((h) => h.finding)

    const nextSevenDays = Array.isArray(parsed.nextSevenDays)
      ? parsed.nextSevenDays
          .slice(0, 7)
          .map((d: { day?: number; task?: string; priority?: string }, i: number) => ({
            day: typeof d.day === "number" ? d.day : i + 1,
            task: typeof d.task === "string" ? d.task : "",
            priority: PRIORITIES.has(d.priority ?? "")
              ? (d.priority as Priority)
              : ("medium" as const),
          }))
      : []

    // Who delivers the verdict: the panelist the user faced, or the
    // weakest-axis owner when they faced several (same mapping as the
    // Panel recommendation).
    const speaker =
      selectVerdictSpeaker(axisKeys(pack), axisOwners(pack), room.characters, room.riskScores) ??
      character

    const { reportId, created } = await ctx.runMutation(internal.reports.create, {
      simulationId: room.simulationId,
      roomId: args.roomId,
      userId: room.userId,
      overallScore,
      verdict: decision,
      executiveSummary,
      panelVerdicts,
      topRisks,
      opportunities,
      nextSevenDays,
      spokenVerdict: {
        speakerId: speaker.id,
        speakerName: speaker.name,
        text: spokenVerdict,
      },
    })

    // Concluding the room and recording continuity are gated on the
    // insert-if-absent result: a concurrent generation that lost the race
    // must not overwrite the winner's output.
    if (created) {
      await ctx.runMutation(internal.rooms.conclude, {
        id: args.roomId,
        verdict: {
          decision,
          summary: verdictSummary,
          confidence: verdictConfidence,
        },
      })

      const rawContinuity = parsed.continuity ?? {}
      const continuitySummary =
        typeof rawContinuity.summary === "string"
          ? rawContinuity.summary.trim().slice(0, CONTINUITY_SUMMARY_CHARS)
          : ""
      const actionItems: string[] = Array.isArray(rawContinuity.actionItems)
        ? rawContinuity.actionItems
            .filter((text: unknown): text is string => typeof text === "string")
            .map((text: string) => text.trim().slice(0, ACTION_ITEM_CHARS))
            .filter((text: string) => text.length > 0)
            .slice(0, MAX_SESSION_ACTION_ITEMS)
        : []
      if (simulation.ideaId && (continuitySummary || actionItems.length > 0)) {
        await ctx.runMutation(internal.ideas.recordContinuity, {
          ideaId: simulation.ideaId,
          roomId: args.roomId,
          summary: continuitySummary,
          actionItems,
        })
      }
    }

    return { reportId }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(100)
    return Promise.all(
      reports.map(async (report) => {
        const simulation = await ctx.db.get(report.simulationId)
        const pack = getPack(simulation?.packId)
        return {
          reportId: report._id,
          simulationId: report.simulationId,
          packId: pack.id,
          subject: simulation
            ? scopeText(scopeOf(simulation), pack.subjectField) || simulation.title
            : "Unknown",
          verdict: report.verdict,
          score: report.overallScore,
          panelist: report.panelVerdicts[0]?.characterName ?? null,
          at: report._creationTime,
        }
      })
    )
  },
})
