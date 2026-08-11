import { v } from "convex/values"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { ownedOrNull, requireIdentity } from "./guard"

// Names and statuses only — extracted text stays server-side (this is not
// a data room).
export const listByPractice = query({
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.practiceId))
    if (!practice) return []
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.practiceId))
      .collect()
    return materials.map((material) => ({
      materialId: material._id,
      name: material.name,
      status: material.status,
    }))
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
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
  args: { practiceId: v.id("practices") },
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_practice", (q) => q.eq("practiceId", args.practiceId))
      .collect()
    return materials.every((material) => material.status !== "extracting")
  },
})
