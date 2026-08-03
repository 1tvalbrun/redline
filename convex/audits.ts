import { v } from "convex/values"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { claimValidator, gapValidator, groundAudit } from "../src/lib/audit"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { ownedOrNull, requireIdentity } from "./guard"

const PROMPT_CHAR_BUDGET = 60_000

// Audits carry no userId of their own — ownership is the parent
// simulation's, checked here and in the public generate entry.
export const getBySimulation = query({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const simulation = ownedOrNull(identity, await ctx.db.get(args.simulationId))
    if (!simulation) return null
    return await ctx.db
      .query("audits")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
  },
})

// Claims a run slot. Returns null when an audit is already running — or
// ready, unless force (an explicit re-run after brief edits) — so concurrent
// triggers (several materials settling, stage auto-start, refreshes)
// collapse to one run.
export const start = internalMutation({
  args: { simulationId: v.id("simulations"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("audits")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .first()
    if (existing) {
      if (existing.status === "running") return null
      if (existing.status === "ready" && !args.force) return null
      // Keep the previous claims and gaps until the new outcome lands: a
      // forced re-run that fails must not have destroyed the last good
      // audit (it drives the pre-run scores and Panel recommendation).
      await ctx.db.patch(existing._id, {
        status: "running",
        failureReason: undefined,
      })
      return existing._id
    }
    return await ctx.db.insert("audits", {
      simulationId: args.simulationId,
      status: "running",
      claims: [],
      gaps: [],
    })
  },
})

export const inputs = internalQuery({
  args: { simulationId: v.id("simulations") },
  handler: async (ctx, args) => {
    const simulation = await ctx.db.get(args.simulationId)
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_simulation", (q) => q.eq("simulationId", args.simulationId))
      .collect()
    return {
      simulation,
      readable: materials.flatMap((material) =>
        material.status === "ready" && material.text
          ? [{ name: material.name, text: material.text }]
          : []
      ),
      unreadableCount: materials.filter((material) => material.status === "failed").length,
    }
  },
})

export const setOutcome = internalMutation({
  args: {
    auditId: v.id("audits"),
    outcome: v.union(
      v.object({
        status: v.literal("ready"),
        claims: v.array(claimValidator),
        gaps: v.array(gapValidator),
      }),
      v.object({ status: v.literal("failed"), failureReason: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.auditId, args.outcome)
  },
})

const generateAudit = async (
  ctx: ActionCtx,
  args: { simulationId: Id<"simulations">; force?: boolean }
): Promise<void> => {
  // Materials still extracting: don't run a materials-blind audit that
  // would then block the corrective re-run (start treats a ready audit as
  // done). The last extraction to settle re-triggers generate, so
  // declining here loses nothing.
  const settled = await ctx.runQuery(internal.materials.allSettled, {
    simulationId: args.simulationId,
  })
  if (!settled) return

  const auditId = await ctx.runMutation(internal.audits.start, {
    simulationId: args.simulationId,
    force: args.force,
  })
  if (!auditId) return

  const fail = (failureReason: string) =>
    ctx.runMutation(internal.audits.setOutcome, {
      auditId,
      outcome: { status: "failed", failureReason },
    })

  try {
    const { simulation, readable, unreadableCount } = await ctx.runQuery(
      internal.audits.inputs,
      { simulationId: args.simulationId }
    )
    if (!simulation) {
      await fail("Simulation not found.")
      return
    }

    const perMaterialBudget =
      readable.length > 0 ? Math.floor(PROMPT_CHAR_BUDGET / readable.length) : 0
    const materialSections =
      readable.length > 0
        ? readable
            .map(
              (material) =>
                `=== ${material.name} ===\n${material.text.slice(0, perMaterialBudget)}`
            )
            .join("\n\n")
        : "(No readable materials were provided.)"

    const openai = await createOpenAI()
    const model = resolveModel("quality")

    const systemPrompt = `You are a diligence analyst auditing a founder's materials before a panel session.

The founder's brief (their own words, NOT evidence):
- Idea: ${simulation.brief.ideaName}
- Stage: ${simulation.brief.stage}
- Description: ${simulation.brief.description}
- Target user: ${simulation.brief.targetUser}
- Business model: ${simulation.brief.businessModel}
${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available as evidence.\n` : ""}
The materials (the ONLY citable evidence). Location markers look like [page 3], [slide 2], [sheet ARR]:

${materialSections}

Every claim and gap is tagged with the diligence axis it bears on:
"market" (TAM, demand, timing), "customer" (pain severity, willingness to pay, switching cost), "technical" (feasibility, reliability, scalability), "gtm" (distribution, sales motion, pricing execution).

TASK 1 — CLAIMS. List the concrete, diligence-relevant claims the materials actually make (metrics, traction, market size, pricing, technology). For each: "text" (the claim, under 20 words), "source" (the exact file name), "location" (a marker that appears in that file, e.g. "page 2", "slide 1", "sheet ARR"; use "document" for files without markers), "axis". Only include claims you can point to in the materials. If the materials are thin, few or zero claims is the correct answer — do not invent.

TASK 2 — GAPS. What a competent diligencer expects but cannot find. Each: "severity" ("blocker" = would stall a real process; "gap" = weakens the story), "kind" ("absent" = expected but in no material; "unsupported" = stated in the brief or materials with no backing evidence), "title" (under 8 words), "detail" (under 25 words), "axis". 3 to 8 gaps.

Return JSON only: {"claims":[{"text","source","location","axis"}],"gaps":[{"severity","kind","title","detail","axis"}]}`

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      await fail("The audit model returned nothing. Try again.")
      return
    }

    const { claims, gaps } = groundAudit(JSON.parse(content), readable)
    await ctx.runMutation(internal.audits.setOutcome, {
      auditId,
      outcome: { status: "ready", claims, gaps },
    })
  } catch (error) {
    // Fixed message only: failureReason is client-readable, and provider
    // error text can carry key fragments and org details. Raw error goes
    // to the server log.
    console.error("[audits.generate]", error)
    await fail("The audit hit an error. Re-run it to try again.")
  }
}

export const generate = action({
  args: { simulationId: v.id("simulations"), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<void> => {
    await requireIdentity(ctx)
    // api.simulations.get is ownership-scoped: someone else's simulation
    // reads as missing, and no model call is spent on it.
    const simulation = await ctx.runQuery(api.simulations.get, {
      id: args.simulationId,
    })
    if (!simulation) return
    await generateAudit(ctx, args)
  },
})

// Scheduler entry: ingest.extract fires this when the last material
// settles. The scheduler runs with no user identity, so it can't go through
// the public, guarded path.
export const run = internalAction({
  args: { simulationId: v.id("simulations"), force: v.optional(v.boolean()) },
  handler: generateAudit,
})
