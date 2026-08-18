import { v, type Infer } from "convex/values"
import { asString, field } from "./audit.ts"

// Single source for the blueprint contract: the schema field, the Convex
// mutations, and the TS types all derive from these validators — same
// discipline as src/lib/audit.ts.

export const themeValidator = v.object({ title: v.string(), detail: v.string() })
export const clarifyingQuestionValidator = v.object({
  question: v.string(),
  // Written by blueprints.requestRefinement, clamped like all scope text.
  answer: v.optional(v.string()),
})
export const questionPlanEntryValidator = v.object({
  theme: v.string(),
  questions: v.array(v.object({ question: v.string(), followUp: v.string() })),
})
export const rubricEntryValidator = v.object({
  theme: v.string(),
  strong: v.string(),
  weak: v.string(),
})

export const blueprintValidator = v.object({
  status: v.union(
    v.literal("generating"),
    v.literal("awaiting-input"),
    v.literal("ready"),
    v.literal("failed")
  ),
  themes: v.array(themeValidator),
  clarifyingQuestions: v.array(clarifyingQuestionValidator),
  // Sealed: stored server-side, never rendered by the client. A user reading
  // the network response only spoils their own practice — accepted.
  questionPlan: v.array(questionPlanEntryValidator),
  rubric: v.array(rubricEntryValidator),
  verifyTopics: v.array(v.string()),
  candidateHooks: v.array(v.string()),
  // The one refinement pass: written when the user submits answers, removals,
  // or a redirect note; completed flips when the pass lands. Its presence —
  // completed or not — closes further refinement requests.
  refinement: v.optional(
    v.object({
      removedThemes: v.array(v.string()),
      redirectNote: v.string(),
      completed: v.boolean(),
    })
  ),
  failureMessage: v.optional(v.string()),
})

export type Blueprint = Infer<typeof blueprintValidator>
export type BlueprintTheme = Infer<typeof themeValidator>
export type ClarifyingQuestion = Infer<typeof clarifyingQuestionValidator>
export type QuestionPlanEntry = Infer<typeof questionPlanEntryValidator>
export type RubricEntry = Infer<typeof rubricEntryValidator>

export const MAX_THEMES = 6
export const MAX_CLARIFYING = 3
export const MAX_QUESTIONS_PER_THEME = 4
export const MAX_VERIFY_TOPICS = 6
export const MAX_HOOKS = 4
export const ANSWER_CHARS = 300
export const REDIRECT_NOTE_CHARS = 240

const THEME_TITLE_CHARS = 60
const THEME_DETAIL_CHARS = 200
const QUESTION_CHARS = 240
const FOLLOW_UP_CHARS = 200
const CLARIFYING_CHARS = 160
const RUBRIC_CHARS = 300
const VERIFY_TOPIC_CHARS = 120
const HOOK_CHARS = 160

export type ParsedBlueprint = {
  themes: BlueprintTheme[]
  clarifyingQuestions: ClarifyingQuestion[]
  questionPlan: QuestionPlanEntry[]
  rubric: RubricEntry[]
  verifyTopics: string[]
  candidateHooks: string[]
}

const stringList = (raw: unknown, max: number, chars: number): string[] =>
  (Array.isArray(raw) ? raw : [])
    .flatMap((entry) => {
      const text = asString(entry)
      return text ? [text.slice(0, chars)] : []
    })
    .slice(0, max)

// Validates and bounds model output. Anything without the minimum viable
// plan — at least one theme with at least one planned question — is
// rejected wholesale to null; the caller stores a failed status with a
// fixed message, never a half-blueprint.
export const parseBlueprint = (raw: unknown): ParsedBlueprint | null => {
  const themesRaw = field(raw, "themes")
  if (!Array.isArray(themesRaw)) return null
  const themes = themesRaw
    .flatMap((entry) => {
      const title = asString(field(entry, "title"))
      const detail = asString(field(entry, "detail"))
      if (!title || !detail) return []
      return [{ title: title.slice(0, THEME_TITLE_CHARS), detail: detail.slice(0, THEME_DETAIL_CHARS) }]
    })
    .slice(0, MAX_THEMES)
  if (themes.length === 0) return null
  const themeTitles = new Set(themes.map((entry) => entry.title))

  const planRaw = field(raw, "questionPlan")
  const questionPlan = (Array.isArray(planRaw) ? planRaw : []).flatMap((entry) => {
    const theme = asString(field(entry, "theme"))?.slice(0, THEME_TITLE_CHARS)
    if (!theme || !themeTitles.has(theme)) return []
    const questionsRaw = field(entry, "questions")
    const questions = (Array.isArray(questionsRaw) ? questionsRaw : [])
      .flatMap((questionEntry) => {
        const question = asString(field(questionEntry, "question"))
        if (!question) return []
        const followUp = asString(field(questionEntry, "followUp")) ?? ""
        return [
          {
            question: question.slice(0, QUESTION_CHARS),
            followUp: followUp.slice(0, FOLLOW_UP_CHARS),
          },
        ]
      })
      .slice(0, MAX_QUESTIONS_PER_THEME)
    return questions.length > 0 ? [{ theme, questions }] : []
  })
  if (questionPlan.length === 0) return null

  const rubricRaw = field(raw, "rubric")
  const rubric = (Array.isArray(rubricRaw) ? rubricRaw : []).flatMap((entry) => {
    const theme = asString(field(entry, "theme"))?.slice(0, THEME_TITLE_CHARS)
    const strong = asString(field(entry, "strong"))
    const weak = asString(field(entry, "weak"))
    if (!theme || !themeTitles.has(theme) || !strong || !weak) return []
    return [{ theme, strong: strong.slice(0, RUBRIC_CHARS), weak: weak.slice(0, RUBRIC_CHARS) }]
  })

  return {
    themes,
    clarifyingQuestions: stringList(
      field(raw, "clarifyingQuestions"),
      MAX_CLARIFYING,
      CLARIFYING_CHARS
    ).map((question) => ({ question })),
    questionPlan,
    rubric,
    verifyTopics: stringList(field(raw, "verifyTopics"), MAX_VERIFY_TOPICS, VERIFY_TOPIC_CHARS),
    candidateHooks: stringList(field(raw, "candidateHooks"), MAX_HOOKS, HOOK_CHARS),
  }
}

export const blueprintStatusFor = (
  questions: ClarifyingQuestion[]
): "ready" | "awaiting-input" =>
  questions.some((question) => !question.answer) ? "awaiting-input" : "ready"

// Same collapse rules as practices.claimAudit, plus one extra door: a
// requested-but-incomplete refinement pass may always claim (that's how the
// scheduled refine run gets in, and how a failed refine retries).
export const canClaimBlueprint = (existing: Blueprint | null, force: boolean): boolean => {
  if (!existing) return true
  if (existing.status === "generating") return false
  if (existing.refinement && !existing.refinement.completed) return true
  if (existing.status === "failed") return true
  return force
}

// Exactly one refinement pass per blueprint: any refinement record —
// pending or completed — closes the door.
export const canRequestRefinement = (blueprint: Blueprint): boolean =>
  (blueprint.status === "ready" || blueprint.status === "awaiting-input") &&
  blueprint.refinement === undefined
