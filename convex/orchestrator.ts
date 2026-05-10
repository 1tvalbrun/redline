import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"

export const decide = action({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.runQuery(api.rooms.get, { id: args.roomId })
    if (!room) throw new Error("Room not found")
    if (room.status !== "live") return null

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini"

    const recentTranscript = room.transcript.slice(-10)
    const characterNames = room.characters.map((c) => c.name)

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a panel orchestrator. Based on the transcript, decide what happens next. Available speakers: ${characterNames.join(", ")}. Current round: ${room.round}. Return JSON only: { "nextSpeaker": string | null, "riskUpdates": { "market"?: number, "customer"?: number, "technical"?: number, "gtm"?: number } | null, "liveNote": { "type": string, "text": string } | null }. Risk scores are 0-100.`,
        },
        {
          role: "user",
          content: JSON.stringify(recentTranscript),
        },
      ],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0].message.content
    if (!content) return null

    const decision = JSON.parse(content)

    if (decision.nextSpeaker) {
      await ctx.runMutation(api.rooms.setActiveSpeaker, {
        id: args.roomId,
        activeCharacterId: decision.nextSpeaker,
      })
    }

    if (decision.riskUpdates) {
      await ctx.runMutation(api.rooms.updateRiskScores, {
        id: args.roomId,
        scores: decision.riskUpdates,
      })
    }

    if (decision.liveNote) {
      await ctx.runMutation(api.rooms.addLiveNote, {
        id: args.roomId,
        note: decision.liveNote,
      })
    }

    return decision
  },
})
