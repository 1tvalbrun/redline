import { v } from "convex/values"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Serve counterpart to generateUploadUrl: resolve a stored file's public URL.
// Convex rejects a hand-built /api/storage/<id> path — only storage.getUrl
// mints a valid URL. Used by scripts/generate-room-scenes.ts to publish the
// verdict-film stills.
export const storageUrl = query({
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
