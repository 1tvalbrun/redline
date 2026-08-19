import { v } from "convex/values"
import { action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { bySpokenTime } from "../src/lib/transcript"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { getPack } from "../src/domains/registry"
import type { NoteType } from "./schema"
import { requireIdentity } from "./guard"
import { recordUsage } from "./usage"

const NOTE_TYPES: ReadonlySet<string> = new Set([
  "follow_up",
  "event",
  "strong_answer",
  "weak_assumption",
  "objection",
] satisfies NoteType[])

type DecideResult = {
  note?: { type?: string; text?: string }
  topic?: string
} | null

export const decide = action({
  args: { sessionId: v.id("sessions") },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (decide → api → decide), which otherwise fails `next build` typechecking.
  handler: async (ctx, args): Promise<DecideResult> => {
    await requireIdentity(ctx)
    const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId })
    if (!session || session.status !== "live") return null
    if (session.transcript.length === 0) return null

    const practice = await ctx.runQuery(api.practices.get, { id: session.practiceId })
    if (!practice) return null

    const persona = session.persona
    const pack = getPack(practice.packId)

    // Speech order, not arrival order: an avatar turn's final arrives only
    // when her next turn starts, so unsorted the model reads answers before
    // their questions and late finals push true turns out of the window.
    const recent = bySpokenTime(session.transcript)
      .slice(-12)
      .map((e) =>
        e.type === "user"
          ? `${pack.userLabel}: ${e.text}`
          : `${persona.name.toUpperCase()}: ${e.text}`
      )
      .join("\n")

    const openai = await createOpenAI()
    const model = resolveModel("fast")

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: pack.prompts.orchestrate({
            characterName: persona.name,
            characterRole: persona.role,
            characterTone: persona.tone,
            scope: practice.scope,
            themes: practice.blueprint?.themes.map((theme) => theme.title) ?? null,
          }),
        },
        { role: "user", content: `Recent conversation:\n${recent}` },
      ],
      response_format: { type: "json_object" },
    })

    await recordUsage(ctx, {
      userId: session.userId,
      kind: "orchestrate",
      practiceId: session.practiceId,
      sessionId: args.sessionId,
      model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    let parsed: { note?: { type?: string; text?: string }; topic?: string }
    try {
      parsed = JSON.parse(content)
    } catch {
      return null
    }

    const note = parsed.note
    if (
      note &&
      typeof note.text === "string" &&
      note.text.trim().length > 0 &&
      typeof note.type === "string" &&
      NOTE_TYPES.has(note.type)
    ) {
      await ctx.runMutation(internal.sessions.addLiveNote, {
        id: args.sessionId,
        note: { type: note.type as NoteType, text: note.text.trim() },
      })
    }

    if (typeof parsed.topic === "string" && parsed.topic.trim().length > 0) {
      await ctx.runMutation(internal.sessions.setTopic, {
        id: args.sessionId,
        topic: parsed.topic.trim(),
      })
    }

    return { note: parsed.note, topic: parsed.topic }
  },
})
