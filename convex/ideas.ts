import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const listWithStats = query({
  args: {},
  handler: async (ctx) => {
    const ideas = await ctx.db.query("ideas").collect()
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
          stage: latest?.brief.stage ?? null,
          businessModel: latest?.brief.businessModel ?? null,
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
    const idea = await ctx.db.get(args.ideaId)
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
      stage: latest?.brief.stage ?? null,
      businessModel: latest?.brief.businessModel ?? null,
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
    const [ideas, rooms, reports] = await Promise.all([
      ctx.db.query("ideas").collect(),
      ctx.db.query("rooms").collect(),
      ctx.db.query("reports").collect(),
    ])
    const best = reports.reduce<number | null>(
      (max, report) => (max === null || report.overallScore > max ? report.overallScore : max),
      null
    )
    return { ideas: ideas.length, sessions: rooms.length, verdicts: reports.length, best }
  },
})

// One-shot grouping for simulations created before ideaId existed.
export const backfillLegacy = mutation({
  args: {},
  handler: async (ctx) => {
    const sims = await ctx.db.query("simulations").collect()
    let patched = 0
    for (const sim of sims) {
      if (sim.ideaId) continue
      const existing = await ctx.db
        .query("ideas")
        .withIndex("by_name", (q) => q.eq("name", sim.brief.ideaName))
        .first()
      const ideaId =
        existing?._id ?? (await ctx.db.insert("ideas", { name: sim.brief.ideaName }))
      await ctx.db.patch(sim._id, { ideaId })
      patched++
    }
    return { patched }
  },
})
