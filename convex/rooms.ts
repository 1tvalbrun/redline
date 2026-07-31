import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { AXES, boundRiskDelta } from "../src/lib/readiness"
import { decisionValidator, noteTypeValidator, transcriptTypeValidator } from "./schema"
import { requireIdentity } from "./guard"

export const create = mutation({
  args: {
    simulationId: v.id("simulations"),
    characters: v.array(
      v.object({
        id: v.string(),
        archetypeId: v.string(),
        name: v.string(),
        role: v.string(),
        avatarId: v.string(),
        tone: v.string(),
        systemPrompt: v.string(),
        status: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    return await ctx.db.insert("rooms", {
      ...args,
      activeCharacterId: args.characters[0]?.id,
      transcript: [],
      riskScores: {},
      liveNotes: [],
      round: "overview",
      status: "live",
    })
  },
})

export const get = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    return await ctx.db.get(args.id)
  },
})

export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    return await ctx.db
      .query("rooms")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
  },
})

export const addTranscriptEntry = mutation({
  args: {
    id: v.id("rooms"),
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
    await requireIdentity(ctx)
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")

    const normalized = args.entry.text.trim().toLowerCase()
    const recent = room.transcript.slice(-4)
    if (args.entry.type === "panelist") {
      const echoesUser = recent.some(
        (e) =>
          e.type === "user" &&
          e.text.trim().toLowerCase() === normalized &&
          args.entry.timestamp - e.timestamp < 30000
      )
      if (echoesUser) return { written: false }
    }
    if (args.entry.type === "user") {
      const echoesPanelist = recent.some(
        (e) =>
          e.type === "panelist" &&
          e.text.trim().toLowerCase() === normalized &&
          args.entry.timestamp - e.timestamp < 30000
      )
      if (echoesPanelist) return { written: false }
    }

    await ctx.db.patch(args.id, {
      transcript: [...room.transcript, args.entry],
    })
    return { written: true }
  },
})

// Internal: written only by orchestrator.decide as it scores the live room.
// Takes the model's *proposed* scores and bounds each against the score in
// the document, inside the serializable mutation — an action-side clamp
// would bound against a stale read when two turns land concurrently.
export const updateRiskScores = internalMutation({
  args: {
    id: v.id("rooms"),
    proposed: v.object({
      market: v.optional(v.number()),
      customer: v.optional(v.number()),
      technical: v.optional(v.number()),
      gtm: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")
    const applied = Object.fromEntries(
      AXES.flatMap((axis) => {
        const proposal = args.proposed[axis]
        if (typeof proposal !== "number") return []
        return [[axis, boundRiskDelta(room.riskScores[axis] ?? 50, proposal)]]
      })
    )
    const riskScores = { ...room.riskScores, ...applied }
    await ctx.db.patch(args.id, { riskScores })
    return riskScores
  },
})

// Internal: written only by orchestrator.decide.
export const addLiveNote = internalMutation({
  args: {
    id: v.id("rooms"),
    note: v.object({
      type: noteTypeValidator,
      text: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")
    await ctx.db.patch(args.id, {
      liveNotes: [
        ...room.liveNotes,
        { ...args.note, timestamp: Date.now() },
      ],
    })
  },
})

// Internal: written only by reports.generate when the session ends.
export const conclude = internalMutation({
  args: {
    id: v.id("rooms"),
    verdict: v.object({
      decision: decisionValidator,
      summary: v.string(),
      confidence: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "concluded",
      verdict: args.verdict,
    })
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    const rooms = await ctx.db.query("rooms").order("desc").take(50)
    return Promise.all(
      rooms.map(async (room) => {
        const simulation = await ctx.db.get(room.simulationId)
        const lastEntry = room.transcript[room.transcript.length - 1]
        return {
          roomId: room._id,
          simulationId: room.simulationId,
          ideaName: simulation?.brief.ideaName ?? "Unknown idea",
          panelist: room.characters[0]?.name ?? null,
          at: room._creationTime,
          lastActivityAt: lastEntry?.timestamp ?? room._creationTime,
          status: room.status,
          turns: room.transcript.length,
          decision: room.verdict?.decision ?? null,
        }
      })
    )
  },
})
