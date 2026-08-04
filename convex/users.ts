import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireIdentity } from "./guard"
import { isPackId } from "../src/domains/registry"
import { TERMS_VERSION } from "../src/lib/legal"

// Identity check without requireIdentity's throw: the onboarding gate mounts
// this on every route, including moments before the Convex socket finishes
// authenticating, and a throw there would crash the app shell. Unauthenticated
// reads fail closed to null, the same signal as "no user row yet".
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first()
  },
})

// Submitting the onboarding form is the acceptance act (clickwrap): the UI
// blocks submit behind the checkbox, the server records when and which
// version. Idempotent: a double-submit or back-navigation returns the
// existing row untouched.
export const completeOnboarding = mutation({
  args: { lane: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    if (!isPackId(args.lane)) throw new Error("Unknown lane")
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first()
    if (existing) return existing._id
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      displayName: typeof identity.name === "string" ? identity.name : undefined,
      lanes: [args.lane],
      defaultLane: args.lane,
      termsAcceptedAt: Date.now(),
      termsVersion: TERMS_VERSION,
    })
  },
})

// Deletes everything the caller owns, the guarantee /privacy makes.
// materials and audits hang off simulations; their storage blobs go too.
// The Clerk account itself survives; signing in again starts at onboarding.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const userId = identity.subject

    const simulations = await ctx.db
      .query("simulations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    for (const simulation of simulations) {
      const materials = await ctx.db
        .query("materials")
        .withIndex("by_simulation", (q) => q.eq("simulationId", simulation._id))
        .collect()
      for (const material of materials) {
        await ctx.storage.delete(material.storageId)
        await ctx.db.delete(material._id)
      }
      const audits = await ctx.db
        .query("audits")
        .withIndex("by_simulation", (q) => q.eq("simulationId", simulation._id))
        .collect()
      for (const audit of audits) await ctx.db.delete(audit._id)
      await ctx.db.delete(simulation._id)
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    for (const room of rooms) await ctx.db.delete(room._id)

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
    for (const report of reports) await ctx.db.delete(report._id)

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .collect()
    for (const idea of ideas) await ctx.db.delete(idea._id)

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", userId))
      .first()
    if (user) await ctx.db.delete(user._id)
  },
})
