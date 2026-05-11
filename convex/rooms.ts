import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

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

export const setActiveSpeaker = mutation({
  args: {
    id: v.id("rooms"),
    activeCharacterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { activeCharacterId: args.activeCharacterId })
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
      type: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")
    await ctx.db.patch(args.id, {
      transcript: [...room.transcript, args.entry],
    })
  },
})

export const updateRiskScores = mutation({
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

export const addLiveNote = mutation({
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

export const setRound = mutation({
  args: {
    id: v.id("rooms"),
    round: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { round: args.round })
  },
})

export const conclude = mutation({
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
