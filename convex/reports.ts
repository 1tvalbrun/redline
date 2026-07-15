import { v } from "convex/values"
import { action, internalMutation, query } from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { bySpokenTime } from "../src/lib/transcript"
import { selectVerdictSpeaker } from "../src/lib/readiness"
import { groundHeldUp } from "../src/lib/reportGrounding"
import { ROOM_SCENE_ENV } from "./runway"

const verdictVideoValidator = v.object({
  status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
  url: v.optional(v.string()),
  speakerId: v.string(),
  speakerName: v.string(),
  script: v.string(),
})

// Internal: the only caller is reports.generate. Insert-if-absent on the
// by_simulation index so two concurrent generations for one room produce one
// report and schedule one paid film — the money guard lives here, on the
// serializable mutation, not in the action's non-transactional check.
export const create = internalMutation({
  args: {
    simulationId: v.id("simulations"),
    roomId: v.id("rooms"),
    overallScore: v.number(),
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
        priority: v.string(),
      })
    ),
    verdictVideo: v.optional(verdictVideoValidator),
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

export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
  },
})

// Internal: written only by runway.generateVerdictVideo as the film renders.
export const setVerdictVideoStatus = internalMutation({
  args: {
    id: v.id("reports"),
    status: v.union(v.literal("ready"), v.literal("failed")),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.id)
    if (!report?.verdictVideo) throw new Error("Report has no verdict video")
    await ctx.db.patch(args.id, {
      verdictVideo: { ...report.verdictVideo, status: args.status, url: args.url },
    })
  },
})

const PRIORITIES = new Set(["high", "medium", "low"])
const DECISIONS = new Set(["advance", "iterate", "pass"])
const clampInt = (n: unknown, fallback: number) =>
  typeof n === "number" ? Math.max(0, Math.min(100, Math.round(n))) : fallback

export const generate = action({
  args: { roomId: v.id("rooms") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (generate → api → generate), which otherwise fails `next build` typechecking.
  handler: async (ctx, args): Promise<{ reportId: Id<"reports"> }> => {
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

    const founderTurns = room.transcript
      .filter((e) => e.type === "user")
      .map((e) => e.text)
    const transcript =
      room.transcript.length > 0
        ? bySpokenTime(room.transcript)
            .map((e) =>
              e.type === "user"
                ? `FOUNDER: ${e.text}`
                : `${character.name.toUpperCase()}: ${e.text}`
            )
            .join("\n")
        : "(No conversation was captured.)"

    const notes =
      room.liveNotes.length > 0
        ? room.liveNotes
            .slice(-10)
            .map((n) => `[${n.type}] ${n.text}`)
            .join("\n")
        : "(none)"

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model =
      process.env.OPENAI_MODEL_QUALITY ??
      process.env.OPENAI_MODEL_FAST ??
      "gpt-4o-mini"

    const systemPrompt = `You are a senior advisor synthesizing a founder panel session into a final report.

Brief:
- Idea: ${simulation.brief.ideaName}
- Description: ${simulation.brief.description}
- Target user: ${simulation.brief.targetUser}
- Business model: ${simulation.brief.businessModel}

Panelist who ran the session: ${character.name} (${character.role})
Panelist's evaluation lens: ${character.tone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce a comprehensive verdict and report. Return JSON ONLY with this exact shape:
{
  "verdict": {
    "decision": "advance" | "iterate" | "pass",
    "summary": "one-sentence rationale",
    "confidence": <integer 0-100>
  },
  "spokenVerdict": "<the verdict as ${character.name} would say it aloud to the founder, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "overallScore": <integer 0-100, higher is better>,
  "executiveSummary": "<3-4 sentences synthesizing the session>",
  "panelVerdict": {
    "verdict": "<one short phrase capturing the panelist's take>",
    "score": <integer 0-100>,
    "reasoning": "<2-3 sentences from the panelist's perspective>"
  },
  "topRisks": ["<short risk>", "<short risk>", "<short risk>"],
  "heldUp": [
    {"finding": "<a claim the FOUNDER stated that survived the panel's pressure, restated in one short sentence with nothing added>",
     "quote": "<the founder's exact words from the transcript stating this claim, copied verbatim>"}
  ],
  "nextSevenDays": [
    {"day": 1, "task": "<concrete action>", "priority": "high"|"medium"|"low"},
    {"day": 2, "task": "<...>", "priority": "..."},
    {"day": 3, "task": "<...>", "priority": "..."},
    {"day": 4, "task": "<...>", "priority": "..."},
    {"day": 5, "task": "<...>", "priority": "..."},
    {"day": 6, "task": "<...>", "priority": "..."},
    {"day": 7, "task": "<...>", "priority": "..."}
  ]
}

Be concrete and specific. Each risk/task should mention something tied to THIS founder's idea, not generic advice.

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative claims the founder actually stated that withstood the panel's scrutiny (evidence, numbers, commitments), each with their verbatim words in "quote". An admission that something is missing, untested, or unknown is NOT a claim that held up — leave it out. If the founder made no defensible claims, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "nextSevenDays", never in "heldUp".
- Nowhere in the report state specifics the transcript does not contain (numbers, buyer types, technologies, market sizes). Where the founder provided nothing, say so plainly.`

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Empty response from report generator")

    const parsed = JSON.parse(content)

    const rawVerdict = parsed.verdict ?? {}
    const decision = DECISIONS.has(rawVerdict.decision)
      ? (rawVerdict.decision as string)
      : "iterate"
    const verdictSummary =
      typeof rawVerdict.summary === "string"
        ? rawVerdict.summary
        : "Verdict pending review."
    const verdictConfidence = clampInt(rawVerdict.confidence, 50)

    // The one-line verdict the panelist speaks aloud — distinct from the
    // written summary. Capped well past the 120-160 target so a rambling
    // model can't produce a minute-long clip.
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
    // "Held up" is grounded like audit claims: a finding the founder can't
    // be quoted on is dropped, and zero survivors is a legitimate report.
    const heldUp = groundHeldUp(parsed.heldUp, founderTurns)
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
              ? (d.priority as string)
              : "medium",
          }))
      : []

    await ctx.runMutation(internal.rooms.conclude, {
      id: args.roomId,
      verdict: {
        decision,
        summary: verdictSummary,
        confidence: verdictConfidence,
      },
    })

    // Who speaks the verdict: the panelist the founder faced, or the
    // weakest-axis owner when they faced several (same mapping as the
    // Panel recommendation). No Runway avatar or no room scene → no film
    // is possible, so the report ships text-only instead of promising a
    // video that can't land.
    const speaker = selectVerdictSpeaker(room.characters, room.riskScores)
    const canFilm = Boolean(speaker?.avatarId && ROOM_SCENE_ENV[speaker.id])
    const verdictVideo =
      canFilm && speaker
        ? {
            status: "pending" as const,
            speakerId: speaker.id,
            speakerName: speaker.name,
            script: spokenVerdict,
          }
        : undefined

    const { reportId, created } = await ctx.runMutation(internal.reports.create, {
      simulationId: room.simulationId,
      roomId: args.roomId,
      overallScore,
      verdict: decision,
      executiveSummary,
      panelVerdicts,
      topRisks,
      opportunities,
      nextSevenDays,
      verdictVideo,
    })

    // Scheduled only when this call actually created the report — a
    // concurrent generation that lost the insert-if-absent race spends no
    // film credits. One report, one paid film.
    if (created && speaker?.avatarId && verdictVideo) {
      await ctx.scheduler.runAfter(0, internal.runway.generateVerdictVideo, {
        reportId,
        avatarId: speaker.avatarId,
        speakerId: speaker.id,
        script: spokenVerdict,
      })
    }

    return { reportId }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").order("desc").take(100)
    return Promise.all(
      reports.map(async (report) => {
        const simulation = await ctx.db.get(report.simulationId)
        return {
          reportId: report._id,
          simulationId: report.simulationId,
          ideaName: simulation?.brief.ideaName ?? "Unknown idea",
          verdict: report.verdict,
          score: report.overallScore,
          panelist: report.panelVerdicts[0]?.characterName ?? null,
          at: report._creationTime,
        }
      })
    )
  },
})
