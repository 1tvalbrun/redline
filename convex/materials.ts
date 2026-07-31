import { v } from "convex/values"
import { internalMutation, internalQuery, mutation } from "./_generated/server"
import { requireIdentity } from "./guard"

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

// Script-only counterparts, internal so they're not client-callable:
// scripts/generate-room-scenes.ts invokes them with `npx convex run`, which
// runs as the deployment admin and has no user identity to satisfy the
// public paths' guard. storageUrl exists because Convex rejects a hand-built
// /api/storage/<id> path — only storage.getUrl mints a valid URL.
export const scriptUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
})

export const storageUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => await ctx.storage.getUrl(args.storageId),
})

export const getForExtraction = internalQuery({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.materialId)
  },
})

export const setExtractionResult = internalMutation({
  args: {
    materialId: v.id("materials"),
    result: v.union(
      v.object({ status: v.literal("ready"), text: v.string() }),
      v.object({ status: v.literal("failed"), failureReason: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.materialId, args.result)
  },
})

export const allSettled = internalQuery({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect()
    return materials.every((material) => material.status !== "extracting")
  },
})
