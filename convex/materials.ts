import { v } from "convex/values"
import { internalMutation, internalQuery, mutation } from "./_generated/server"

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
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
