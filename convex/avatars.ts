import { v } from "convex/values"
import { internalMutation, query } from "./_generated/server"
import { requireIdentity } from "./guard"
import { getPack, isPackId } from "../src/domains/registry"

// Adopts a Runway Character for a pack persona (upsert). Internal on
// purpose: only the developer registers avatars, via
//   npx convex run avatars:register '{"packId":"founder","personaId":"vc-01","runwayAvatarId":"..."}'
export const register = internalMutation({
  args: {
    packId: v.string(),
    personaId: v.string(),
    runwayAvatarId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isPackId(args.packId)) throw new Error(`Unknown pack: ${args.packId}`)
    const pack = getPack(args.packId)
    if (!pack.personas.some((persona) => persona.id === args.personaId)) {
      throw new Error(`Unknown persona for ${args.packId}: ${args.personaId}`)
    }
    const existing = await ctx.db
      .query("avatars")
      .withIndex("by_pack_persona", (q) =>
        q.eq("packId", args.packId).eq("personaId", args.personaId)
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { runwayAvatarId: args.runwayAvatarId })
      return existing._id
    }
    return await ctx.db.insert("avatars", args)
  },
})

// The connect route's allowlist: sessions are billable, so it only mints
// them for registered avatars. Unregistered reads as false (fail closed).
export const allowed = query({
  args: { runwayAvatarId: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const avatar = await ctx.db
      .query("avatars")
      .withIndex("by_runway", (q) => q.eq("runwayAvatarId", args.runwayAvatarId))
      .first()
    return avatar !== null
  },
})
