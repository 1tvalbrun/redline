import { v } from "convex/values"
import { action, mutation, query } from "./_generated/server"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

export const create = mutation({
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
    mediaStatus: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reports", args)
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

export const updateMedia = mutation({
  args: {
    id: v.id("reports"),
    generatedMedia: v.object({
      successVideo: v.optional(v.string()),
      failureVideo: v.optional(v.string()),
    }),
    mediaStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      generatedMedia: args.generatedMedia,
      mediaStatus: args.mediaStatus,
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

    const transcript =
      room.transcript.length > 0
        ? room.transcript
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
  "overallScore": <integer 0-100, higher is better>,
  "executiveSummary": "<3-4 sentences synthesizing the session>",
  "panelVerdict": {
    "verdict": "<one short phrase capturing the panelist's take>",
    "score": <integer 0-100>,
    "reasoning": "<2-3 sentences from the panelist's perspective>"
  },
  "topRisks": ["<short risk>", "<short risk>", "<short risk>"],
  "opportunities": ["<short opportunity>", "<short opportunity>", "<short opportunity>"],
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

Be concrete and specific. Each risk/opportunity/task should mention something tied to THIS founder's idea, not generic advice.`

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
    const opportunities = Array.isArray(parsed.opportunities)
      ? parsed.opportunities.filter((o: unknown) => typeof o === "string").slice(0, 5)
      : []

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

    await ctx.runMutation(api.rooms.conclude, {
      id: args.roomId,
      verdict: {
        decision,
        summary: verdictSummary,
        confidence: verdictConfidence,
      },
    })

    const reportId = await ctx.runMutation(api.reports.create, {
      simulationId: room.simulationId,
      roomId: args.roomId,
      overallScore,
      verdict: decision,
      executiveSummary,
      panelVerdicts,
      topRisks,
      opportunities,
      nextSevenDays,
      mediaStatus: "pending",
    })

    await ctx.scheduler.runAfter(0, api.runway.generateImage, {
      reportId,
      decision,
      ideaName: simulation.brief.ideaName,
      summary: verdictSummary,
    })

    return { reportId }
  },
})
