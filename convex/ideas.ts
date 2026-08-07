import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { getPack, scopeOf } from "../src/domains/registry"
import { scopeText, type Brief, type Scope } from "../src/domains/types"
import { ownedOrNull, requireIdentity } from "./guard"

const MAX_OPEN_ITEMS = 10
const MAX_TOTAL_ITEMS = 30

// Internal: written only by reports.generate after the winning report
// insert (its insert-if-absent guard makes this once-per-room). New items
// fill the remaining open slots; settled history is kept newest-first up
// to the total cap so the array stays bounded forever.
export const recordContinuity = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    roomId: v.id("rooms"),
    summary: v.string(),
    actionItems: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId)
    if (!idea) return
    const existing = idea.continuity?.actionItems ?? []
    const open = existing.filter((item) => item.status === "open")
    const now = Date.now()
    // The report prompt is told not to re-emit tracked commitments; this is
    // the server-side backstop for when it does anyway.
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
    const tracked = new Set(existing.map((item) => normalize(item.text)))
    const fresh = args.actionItems
      .filter((text) => !tracked.has(normalize(text)))
      .slice(0, Math.max(0, MAX_OPEN_ITEMS - open.length))
      .map((text, i) => ({
        id: `${args.roomId}:${i}`,
        text,
        status: "open" as const,
        fromRoomId: args.roomId,
        createdAt: now,
      }))
    const settled = existing
      .filter((item) => item.status !== "open")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, MAX_TOTAL_ITEMS - open.length - fresh.length))
    await ctx.db.patch(args.ideaId, {
      continuity: {
        lastSessionSummary: args.summary || idea.continuity?.lastSessionSummary || "",
        actionItems: [...open, ...fresh, ...settled],
        updatedAt: now,
      },
    })
  },
})

// The user settling their own commitment — or undoing a mis-click. Legal
// transitions: open → done/dropped, and done/dropped → open (reopen). An
// unknown, unowned, or same-state item reads as missing.
export const setActionItemStatus = mutation({
  args: {
    ideaId: v.id("ideas"),
    itemId: v.string(),
    status: v.union(v.literal("done"), v.literal("dropped"), v.literal("open")),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const idea = ownedOrNull(identity, await ctx.db.get(args.ideaId))
    if (!idea?.continuity) throw new Error("Not found")
    const target = idea.continuity.actionItems.find((item) => item.id === args.itemId)
    const legal =
      args.status === "open" ? target && target.status !== "open" : target?.status === "open"
    if (!target || !legal) throw new Error("Not found")
    await ctx.db.patch(args.ideaId, {
      continuity: {
        ...idea.continuity,
        actionItems: idea.continuity.actionItems.map((item) =>
          item.id === args.itemId ? { ...item, status: args.status } : item
        ),
        updatedAt: Date.now(),
      },
    })
  },
})

// Continuity for a run's briefing, resolved through the owned simulation so
// the connect route fetches it in the same parallel round trip as the rest.
export const continuityForSimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const simulation = ownedOrNull(identity, await ctx.db.get(args.simulationId))
    if (!simulation?.ideaId) return null
    const idea = ownedOrNull(identity, await ctx.db.get(simulation.ideaId))
    return idea?.continuity ?? null
  },
})

// The pack's subtitle fields (e.g. stage · business model), resolved from
// whichever scope shape the row stores.
const subtitleOf = (
  simulation: { packId?: string; scope?: Scope; brief?: Brief } | undefined
): string[] => {
  if (!simulation) return []
  const pack = getPack(simulation.packId)
  const scope = scopeOf(simulation)
  return pack.subtitleFields
    .map((key) => scopeText(scope, key))
    .filter((value) => value.length > 0)
}

export const listWithStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user_name", (q) => q.eq("userId", identity.subject))
      .collect()
    const stats = await Promise.all(
      ideas.map(async (idea) => {
        const sims = await ctx.db
          .query("simulations")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .collect()
        sims.sort((a, b) => a._creationTime - b._creationTime)
        const runs = await Promise.all(
          sims.map(async (sim) => {
            const report = await ctx.db
              .query("reports")
              .withIndex("by_simulation", (q) => q.eq("simulationId", sim._id))
              .first()
            return {
              simulationId: sim._id,
              at: sim._creationTime,
              score: report?.overallScore ?? null,
            }
          })
        )
        const latest = sims[sims.length - 1]
        const latestRoom = latest
          ? await ctx.db
              .query("rooms")
              .withIndex("by_simulation", (q) => q.eq("simulationId", latest._id))
              .first()
          : null
        return {
          ideaId: idea._id,
          name: idea.name,
          packId: getPack(idea.packId ?? latest?.packId).id,
          meta: subtitleOf(latest),
          runs,
          lastRunAt: latest?._creationTime ?? idea._creationTime,
          latestSimulationId: latest?._id ?? null,
          latestRiskScores: latestRoom?.riskScores ?? null,
          openQuestions: latest?.context?.openQuestions ?? null,
        }
      })
    )
    return stats.sort((a, b) => b.lastRunAt - a.lastRunAt)
  },
})

export const getDetail = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const idea = ownedOrNull(identity, await ctx.db.get(args.ideaId))
    if (!idea) return null

    const sims = await ctx.db
      .query("simulations")
      .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
      .collect()
    sims.sort((a, b) => a._creationTime - b._creationTime)

    const runs = await Promise.all(
      sims.map(async (sim) => {
        const report = await ctx.db
          .query("reports")
          .withIndex("by_simulation", (q) => q.eq("simulationId", sim._id))
          .first()
        return {
          simulationId: sim._id,
          at: sim._creationTime,
          score: report?.overallScore ?? null,
          verdict: report?.verdict ?? null,
          panelist: report?.panelVerdicts[0]?.characterName ?? null,
          topRisks: report?.topRisks ?? null,
        }
      })
    )

    const latest = sims[sims.length - 1]
    const latestRoom = latest
      ? await ctx.db
          .query("rooms")
          .withIndex("by_simulation", (q) => q.eq("simulationId", latest._id))
          .first()
      : null
    const lastScored = [...runs].reverse().find((run) => run.score !== null)

    return {
      ideaId: idea._id,
      name: idea.name,
      packId: getPack(idea.packId ?? latest?.packId).id,
      meta: subtitleOf(latest),
      continuity: idea.continuity ?? null,
      lastRunAt: latest?._creationTime ?? idea._creationTime,
      runs: runs.map((run) => ({
        simulationId: run.simulationId,
        at: run.at,
        score: run.score,
        verdict: run.verdict,
        panelist: run.panelist,
      })),
      topRisks: lastScored?.topRisks ?? [],
      latestRiskScores: latestRoom?.riskScores ?? null,
      openQuestions: latest?.context?.openQuestions ?? null,
    }
  },
})

export const counts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const [ideas, rooms, reports] = await Promise.all([
      ctx.db
        .query("ideas")
        .withIndex("by_user_name", (q) => q.eq("userId", identity.subject))
        .collect(),
      ctx.db
        .query("rooms")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
      ctx.db
        .query("reports")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
    ])
    const best = reports.reduce<number | null>(
      (max, report) => (max === null || report.overallScore > max ? report.overallScore : max),
      null
    )
    return { ideas: ideas.length, sessions: rooms.length, verdicts: reports.length, best }
  },
})

