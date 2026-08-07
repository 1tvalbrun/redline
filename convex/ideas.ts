import { v } from "convex/values"
import { query } from "./_generated/server"
import { getPack, scopeOf } from "../src/domains/registry"
import { scopeText, type Brief, type Scope } from "../src/domains/types"
import { ownedOrNull, requireIdentity } from "./guard"

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
          packId: getPack(latest?.packId).id,
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
      packId: getPack(latest?.packId).id,
      meta: subtitleOf(latest),
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

