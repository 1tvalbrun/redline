import { v } from "convex/values"
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { boundRiskDelta } from "../src/lib/readiness"
import { axisKeys, getPack, scopeOf } from "../src/domains/registry"
import { scopeText, type DomainPack } from "../src/domains/types"
import { noteTypeValidator, transcriptTypeValidator } from "./schema"
import { ownedOrNull, requireIdentity } from "./guard"

// Persona text comes from the pack and the Runway avatar id from the
// registry, so neither can be injected. Only the session-relevant slice of
// the persona is stored — the pack carries UI-only fields (image, attack,
// bio, tags, axes) that would fail the room schema. Shared by rooms.create
// and simulations.continueRun.
export const insertRoomForPersona = async (
  ctx: MutationCtx,
  simulationId: Id<"simulations">,
  userId: string,
  pack: DomainPack,
  personaId: string
): Promise<Id<"rooms">> => {
  const persona = pack.personas.find((p) => p.id === personaId)
  if (!persona) throw new Error("Unknown character")
  const avatar = await ctx.db
    .query("avatars")
    .withIndex("by_pack_persona", (q) =>
      q.eq("packId", pack.id).eq("personaId", persona.id)
    )
    .first()
  if (!avatar) throw new Error("No avatar registered for this panelist")
  return await ctx.db.insert("rooms", {
    simulationId,
    userId,
    characters: [
      {
        id: persona.id,
        archetypeId: persona.archetypeId,
        name: persona.name,
        role: persona.role,
        tone: persona.tone,
        avatarId: avatar.runwayAvatarId,
        status: "idle",
      },
    ],
    activeCharacterId: persona.id,
    transcript: [],
    riskScores: {},
    liveNotes: [],
    status: "live",
  })
}

export const create = mutation({
  args: {
    simulationId: v.id("simulations"),
    characterId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const simulation = ownedOrNull(identity, await ctx.db.get(args.simulationId))
    if (!simulation) throw new Error("Simulation not found")
    return await insertRoomForPersona(
      ctx,
      args.simulationId,
      identity.subject,
      getPack(simulation.packId),
      args.characterId
    )
  },
})

export const get = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return ownedOrNull(identity, await ctx.db.get(args.id))
  },
})

export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
    return ownedOrNull(identity, room)
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
    const identity = await requireIdentity(ctx)
    const room = ownedOrNull(identity, await ctx.db.get(args.id))
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
// would bound against a stale read when two turns land concurrently. Axis
// keys are validated against the simulation's pack here, so a proposal
// outside the pack's vocabulary never lands in the document.
export const updateRiskScores = internalMutation({
  args: {
    id: v.id("rooms"),
    proposed: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Room not found")
    const simulation = await ctx.db.get(room.simulationId)
    const axes = axisKeys(getPack(simulation?.packId))
    const applied = Object.fromEntries(
      axes.flatMap((axis) => {
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

// Internal: written only by reports.generate when the session ends, which
// validates the decision against the pack's verdict vocabulary.
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
    const identity = await requireIdentity(ctx)
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(50)
    return Promise.all(
      rooms.map(async (room) => {
        const simulation = await ctx.db.get(room.simulationId)
        const pack = getPack(simulation?.packId)
        const lastEntry = room.transcript[room.transcript.length - 1]
        return {
          roomId: room._id,
          simulationId: room.simulationId,
          packId: pack.id,
          subject: simulation
            ? scopeText(scopeOf(simulation), pack.subjectField) || simulation.title
            : "Unknown",
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
