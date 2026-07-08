import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"

const NOTE_TYPES = new Set([
  "follow_up",
  "event",
  "strong_answer",
  "weak_assumption",
  "objection",
])

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const boundDelta = (current: number, proposed: number, maxDelta = 10) => {
  const diff = proposed - current
  if (Math.abs(diff) <= maxDelta) return clamp(proposed)
  return clamp(current + Math.sign(diff) * maxDelta)
}

type DecideResult = {
  scores: { market: number; customer: number; technical: number; gtm: number }
  note?: { type?: string; text?: string }
} | null

export const decide = action({
  args: { roomId: v.id("rooms") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (decide → api → decide), which otherwise fails `next build` typechecking.
  handler: async (ctx, args): Promise<DecideResult> => {
    const room = await ctx.runQuery(api.rooms.get, { id: args.roomId })
    if (!room || room.status !== "live") return null
    if (room.transcript.length === 0) return null

    const simulation = await ctx.runQuery(api.simulations.get, {
      id: room.simulationId,
    })
    if (!simulation) return null

    const character = room.characters[0]
    if (!character) return null

    const recent = room.transcript
      .slice(-12)
      .map((e) =>
        e.type === "user"
          ? `FOUNDER: ${e.text}`
          : `${character.name.toUpperCase()}: ${e.text}`
      )
      .join("\n")

    const current = {
      market: room.riskScores.market ?? 50,
      customer: room.riskScores.customer ?? 50,
      technical: room.riskScores.technical ?? 50,
      gtm: room.riskScores.gtm ?? 50,
    }

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini"

    const systemPrompt = `You are observing a live founder pitch and scoring it in real time alongside ${character.name} (${character.role}).

Pitch context:
- Idea: ${simulation.brief.ideaName}
- Description: ${simulation.brief.description}
- Target user: ${simulation.brief.targetUser}
- Business model: ${simulation.brief.businessModel}

${character.name}'s evaluation lens (guides which risks you watch hardest, but you MUST score all four):
${character.tone}

Risk dimensions, each scored 0-100 (0 = no concern, 100 = critical risk):
- market: TAM, demand intensity, market timing
- customer: pain severity, willingness to pay, switching cost
- technical: feasibility, scalability, accuracy/latency claims
- gtm: distribution, sales motion, channel risk

Current scores:
- market=${current.market}
- customer=${current.customer}
- technical=${current.technical}
- gtm=${current.gtm}

CRITICAL RULES — read carefully:
1. Assess each of the four dimensions INDEPENDENTLY. Do NOT apply a single overall judgment to all four.
2. For each dimension, ask: "did the most recent turn in this conversation touch THIS specific dimension?"
   - If NO: return the CURRENT value UNCHANGED (exact same integer).
   - If YES: adjust the score by between 1 and 8 points (in either direction) based on the answer's quality on THAT specific dimension.
3. In most turns, only 1 or 2 dimensions will be touched. The other 2-3 should be UNCHANGED.
4. Strong, specific, evidence-backed founder answers DECREASE the relevant dimension.
5. Vague, dodgy, hand-wavy, or unsupported claims INCREASE the relevant dimension.
6. Whole integers, 0-100 only. Never move by more than 10 points in a single turn.

Also produce ONE short observation (8-18 words) about the most recent founder turn. Classify it:
- strong_answer: founder gave a sharp, specific answer
- weak_assumption: founder relied on a claim that won't hold up
- objection: panelist pushed back on something
- follow_up: a question still hanging
- event: a notable shift in tone or topic

Respond with JSON only, exactly this shape:
{"riskScores":{"market":int,"customer":int,"technical":int,"gtm":int},"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"}}`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Recent conversation:\n${recent}` },
      ],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    let parsed: {
      riskScores?: Partial<Record<"market" | "customer" | "technical" | "gtm", number>>
      note?: { type?: string; text?: string }
    }
    try {
      parsed = JSON.parse(content)
    } catch {
      return null
    }

    const r = parsed.riskScores ?? {}
    const scores = {
      market: typeof r.market === "number" ? boundDelta(current.market, r.market) : current.market,
      customer: typeof r.customer === "number" ? boundDelta(current.customer, r.customer) : current.customer,
      technical: typeof r.technical === "number" ? boundDelta(current.technical, r.technical) : current.technical,
      gtm: typeof r.gtm === "number" ? boundDelta(current.gtm, r.gtm) : current.gtm,
    }

    await ctx.runMutation(api.rooms.updateRiskScores, {
      id: args.roomId,
      scores,
    })

    const note = parsed.note
    if (
      note &&
      typeof note.text === "string" &&
      note.text.trim().length > 0 &&
      typeof note.type === "string" &&
      NOTE_TYPES.has(note.type)
    ) {
      await ctx.runMutation(api.rooms.addLiveNote, {
        id: args.roomId,
        note: { type: note.type, text: note.text.trim() },
      })
    }

    return { scores, note }
  },
})
