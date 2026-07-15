import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"

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
    return await ctx.db.get(args.id)
  },
})

export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
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
      type: v.string(),
    }),
  },
  handler: async (ctx, args) => {
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
export const updateRiskScores = internalMutation({
  args: {
    id: v.id("rooms"),
    scores: v.object({
      market: v.optional(v.number()),
      customer: v.optional(v.number()),
      technical: v.optional(v.number()),
      gtm: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")
    await ctx.db.patch(args.id, {
      riskScores: { ...room.riskScores, ...args.scores },
    })
  },
})

// Internal: written only by orchestrator.decide.
export const addLiveNote = internalMutation({
  args: {
    id: v.id("rooms"),
    note: v.object({
      type: v.string(),
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
      decision: v.string(),
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
