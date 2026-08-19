import { v } from "convex/values"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type ActionCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { getPack } from "../src/domains/registry"
import {
  ANSWER_CHARS,
  REDIRECT_NOTE_CHARS,
  blueprintStatusFor,
  canClaimBlueprint,
  canRequestRefinement,
  clarifyingQuestionValidator,
  parseBlueprint,
  questionPlanEntryValidator,
  rubricEntryValidator,
  themeValidator,
} from "../src/lib/blueprint"
import { recordUsage } from "./usage"
import { ownedOrNull, requireIdentity } from "./guard"

// Same discipline as the audit pipeline: one claim slot on the embedded
// field so concurrent triggers collapse, a fixed user-facing failure
// message (provider error text never reaches the client), and the quality
// model tier for the generation itself.
const PROMPT_CHAR_BUDGET = 60_000
const FAILURE_MESSAGE = "The blueprint hit an error. Re-run it to try again."

const EMPTY_CONTENT = {
  themes: [],
  clarifyingQuestions: [],
  questionPlan: [],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
}

export const getPractice = internalQuery({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const claim = internalMutation({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return false
    const existing = practice.blueprint ?? null
    if (!canClaimBlueprint(existing, args.force ?? false)) return false
    await ctx.db.patch(args.id, {
      // Keep the previous plan until the new outcome lands: a re-run that
      // fails must not have destroyed the last good blueprint.
      blueprint: existing
        ? { ...existing, status: "generating", failureMessage: undefined }
        : { status: "generating", ...EMPTY_CONTENT },
    })
    return true
  },
})

export const setOutcome = internalMutation({
  args: {
    id: v.id("practices"),
    outcome: v.union(
      v.object({
        status: v.literal("ready"),
        themes: v.array(themeValidator),
        clarifyingQuestions: v.array(clarifyingQuestionValidator),
        questionPlan: v.array(questionPlanEntryValidator),
        rubric: v.array(rubricEntryValidator),
        verifyTopics: v.array(v.string()),
        candidateHooks: v.array(v.string()),
      }),
      v.object({ status: v.literal("failed"), failureMessage: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return
    const previous = practice.blueprint
    if (args.outcome.status === "failed") {
      await ctx.db.patch(args.id, {
        blueprint: {
          ...(previous ?? EMPTY_CONTENT),
          status: "failed",
          failureMessage: args.outcome.failureMessage,
        },
      })
      return
    }
    const refining = previous?.refinement !== undefined && !previous.refinement.completed
    // Refinement closes after one pass: the answered questions are kept for
    // display, the pass's own clarifyingQuestions are discarded, and the
    // status lands on ready — there is no second round.
    const clarifyingQuestions = refining
      ? (previous?.clarifyingQuestions ?? [])
      : args.outcome.clarifyingQuestions
    await ctx.db.patch(args.id, {
      blueprint: {
        status: refining ? "ready" : blueprintStatusFor(clarifyingQuestions),
        themes: args.outcome.themes,
        clarifyingQuestions,
        questionPlan: args.outcome.questionPlan,
        rubric: args.outcome.rubric,
        verifyTopics: args.outcome.verifyTopics,
        candidateHooks: args.outcome.candidateHooks,
        ...(previous?.refinement
          ? { refinement: { ...previous.refinement, completed: true } }
          : {}),
      },
    })
  },
})

const materialInputs = async (ctx: ActionCtx, id: Id<"practices">) => {
  const { readable, unreadableCount } = await ctx.runQuery(internal.practices.auditInputs, { id })
  const perMaterialBudget =
    readable.length > 0 ? Math.floor(PROMPT_CHAR_BUDGET / readable.length) : 0
  return {
    unreadableCount,
    materialSections:
      readable.length > 0
        ? readable
            .map(
              (material) =>
                `=== ${material.name} ===\n${material.text.slice(0, perMaterialBudget)}`
            )
            .join("\n\n")
        : "(No materials were provided.)",
  }
}

const generateBlueprint = async (
  ctx: ActionCtx,
  args: { id: Id<"practices">; force?: boolean }
): Promise<void> => {
  // Materials still extracting: don't build a materials-blind plan. The
  // last extraction to settle re-triggers this via ingest.extract.
  const settled = await ctx.runQuery(internal.materials.allSettled, { practiceId: args.id })
  if (!settled) return

  const kind = await ctx.runQuery(internal.practices.prepKind, { id: args.id })
  if (kind !== "blueprint") return

  const claimed = await ctx.runMutation(internal.blueprints.claim, {
    id: args.id,
    force: args.force,
  })
  if (!claimed) return

  const fail = () =>
    ctx.runMutation(internal.blueprints.setOutcome, {
      id: args.id,
      outcome: { status: "failed", failureMessage: FAILURE_MESSAGE },
    })

  try {
    const practice = await ctx.runQuery(internal.blueprints.getPractice, { id: args.id })
    if (!practice) {
      await fail()
      return
    }
    const pack = getPack(practice.packId)
    if (pack.prep.kind !== "blueprint") {
      await fail()
      return
    }

    const current = practice.blueprint
    const refinement =
      current?.refinement !== undefined && !current.refinement.completed
        ? current.refinement
        : null
    // The refine prompt works from the stored plan and the user's input;
    // only the initial generation pays to read the material text.
    const prompt =
      refinement && current
        ? pack.prep.refine({
            scope: practice.scope,
            blueprint: current,
            removedThemes: refinement.removedThemes,
            redirectNote: refinement.redirectNote,
          })
        : pack.prep.prompt({ scope: practice.scope, ...(await materialInputs(ctx, args.id)) })

    const openai = await createOpenAI()
    const model = resolveModel("quality")
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    })

    await recordUsage(ctx, {
      userId: practice.userId,
      kind: refinement && current ? "blueprint_refine" : "blueprint",
      practiceId: args.id,
      model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      await fail()
      return
    }
    const parsed = parseBlueprint(JSON.parse(content))
    if (!parsed) {
      await fail()
      return
    }
    await ctx.runMutation(internal.blueprints.setOutcome, {
      id: args.id,
      outcome: { status: "ready", ...parsed },
    })
  } catch (error) {
    // Fixed message only — raw error goes to the server log.
    console.error("[blueprints.run]", error)
    await fail()
  }
}

// No public force: a ready blueprint can't be client-regenerated in a loop
// (metered model spend). Forced re-runs go through runInternal via the CLI.
export const run = action({
  args: { id: v.id("practices") },
  handler: async (ctx, args): Promise<void> => {
    await requireIdentity(ctx)
    // Ownership-scoped read: someone else's practice reads as missing and
    // no model call is spent on it.
    const practice = await ctx.runQuery(api.practices.get, { id: args.id })
    if (!practice) return
    await generateBlueprint(ctx, args)
  },
})

// Scheduler entry: ingest.extract and requestRefinement fire this without a
// user identity.
export const runInternal = internalAction({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: generateBlueprint,
})

// The single refinement pass: stores the user's answers, removals, and
// redirect note (clamped like all scope text), then schedules the run that
// consumes them. One request per blueprint, enforced server-side.
export const requestRefinement = mutation({
  args: {
    id: v.id("practices"),
    answers: v.array(v.object({ question: v.string(), answer: v.string() })),
    removedThemes: v.array(v.string()),
    redirectNote: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    const blueprint = practice?.blueprint
    if (!practice || !blueprint) throw new Error("Practice not found")
    if (!canRequestRefinement(blueprint)) {
      throw new Error(
        blueprint.refinement
          ? "The plan has already been refined"
          : "The plan isn't ready to refine yet"
      )
    }

    const answered = blueprint.clarifyingQuestions.map((entry) => {
      const match = args.answers.find((answer) => answer.question === entry.question)
      const answer = match?.answer.trim().slice(0, ANSWER_CHARS)
      return answer ? { ...entry, answer } : entry
    })
    const themeTitles = new Set(blueprint.themes.map((theme) => theme.title))
    const removedThemes = [...new Set(args.removedThemes.filter((title) => themeTitles.has(title)))]
    if (removedThemes.length >= blueprint.themes.length) {
      throw new Error("At least one theme must remain")
    }
    const redirectNote = args.redirectNote.trim().slice(0, REDIRECT_NOTE_CHARS)
    const answeredAnything = answered.some(
      (entry, i) => entry.answer && !blueprint.clarifyingQuestions[i].answer
    )
    if (!answeredAnything && removedThemes.length === 0 && redirectNote.length === 0) {
      throw new Error("Nothing to refine")
    }

    await ctx.db.patch(args.id, {
      blueprint: {
        ...blueprint,
        clarifyingQuestions: answered,
        refinement: { removedThemes, redirectNote, completed: false },
      },
    })
    await ctx.scheduler.runAfter(0, internal.blueprints.runInternal, { id: args.id })
  },
})
