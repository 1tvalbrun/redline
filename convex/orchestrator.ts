import { v } from "convex/values"
import { action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { bySpokenTime } from "../src/lib/transcript"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { axisKeys, getPack, scopeOf } from "../src/domains/registry"
import type { NoteType } from "./schema"
import { requireIdentity } from "./guard"

const NOTE_TYPES: ReadonlySet<string> = new Set([
  "follow_up",
  "event",
  "strong_answer",
  "weak_assumption",
  "objection",
] satisfies NoteType[])

type DecideResult = {
  scores: Record<string, number>
  note?: { type?: string; text?: string }
} | null

export const decide = action({
  args: { roomId: v.id("rooms") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (decide → api → decide), which otherwise fails `next build` typechecking.
  handler: async (ctx, args): Promise<DecideResult> => {
    await requireIdentity(ctx)
    const room = await ctx.runQuery(api.rooms.get, { id: args.roomId })
    if (!room || room.status !== "live") return null
    if (room.transcript.length === 0) return null

    const simulation = await ctx.runQuery(api.simulations.get, {
      id: room.simulationId,
    })
    if (!simulation) return null

    const character = room.characters[0]
    if (!character) return null

    const pack = getPack(simulation.packId)
    const axes = axisKeys(pack)

    // Speech order, not arrival order: an avatar turn's final arrives only
    // when her next turn starts, so unsorted the model reads answers before
    // their questions and late finals push true turns out of the window.
    const recent = bySpokenTime(room.transcript)
      .slice(-12)
      .map((e) =>
        e.type === "user"
          ? `${pack.userLabel}: ${e.text}`
          : `${character.name.toUpperCase()}: ${e.text}`
      )
      .join("\n")

    const current = Object.fromEntries(
      axes.map((axis) => [axis, room.riskScores[axis] ?? 50])
    )

    const openai = await createOpenAI()
    const model = resolveModel("fast")

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: pack.prompts.orchestrate({
            characterName: character.name,
            characterRole: character.role,
            characterTone: character.tone,
            scope: scopeOf(simulation),
            current,
          }),
        },
        { role: "user", content: `Recent conversation:\n${recent}` },
      ],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    let parsed: {
      riskScores?: Partial<Record<string, number>>
      note?: { type?: string; text?: string }
    }
    try {
      parsed = JSON.parse(content)
    } catch {
      return null
    }

    // Raw proposals only — the mutation bounds each axis against the
    // committed score, so concurrent turns can't clamp against stale reads.
    const r = parsed.riskScores ?? {}
    const proposed = Object.fromEntries(
      axes.flatMap((axis) => {
        const value = r[axis]
        return typeof value === "number" ? [[axis, value]] : []
      })
    )
    const updated = await ctx.runMutation(internal.rooms.updateRiskScores, {
      id: args.roomId,
      proposed,
    })
    const scores = Object.fromEntries(
      axes.map((axis) => [axis, updated[axis] ?? current[axis]])
    )

    const note = parsed.note
    if (
      note &&
      typeof note.text === "string" &&
      note.text.trim().length > 0 &&
      typeof note.type === "string" &&
      NOTE_TYPES.has(note.type)
    ) {
      await ctx.runMutation(internal.rooms.addLiveNote, {
        id: args.roomId,
        note: { type: note.type as NoteType, text: note.text.trim() },
      })
    }

    return { scores, note }
  },
})
