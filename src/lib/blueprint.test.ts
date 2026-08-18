import test from "node:test"
import assert from "node:assert/strict"
import {
  blueprintStatusFor,
  canClaimBlueprint,
  canRequestRefinement,
  parseBlueprint,
  type Blueprint,
} from "./blueprint.ts"

const theme = (i: number) => ({ title: `Theme ${i}`, detail: `What theme ${i} probes` })
const planEntry = (i: number) => ({
  theme: `Theme ${i}`,
  questions: [{ question: `Question for theme ${i}`, followUp: "Press for specifics" }],
})

const validRaw = {
  themes: [theme(1), theme(2)],
  clarifyingQuestions: ["Which state are you licensed in?"],
  questionPlan: [planEntry(1), planEntry(2)],
  rubric: [{ theme: "Theme 1", strong: "Concrete and owned", weak: "Vague and borrowed" }],
  verifyTopics: ["Georgia licensing requirements"],
  candidateHooks: ["Led the ICU float pool through the Epic migration"],
}

test("a well-formed blueprint parses with every section", () => {
  const parsed = parseBlueprint(validRaw)
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 2)
  assert.equal(parsed.clarifyingQuestions[0].question, "Which state are you licensed in?")
  assert.equal(parsed.clarifyingQuestions[0].answer, undefined)
  assert.equal(parsed.questionPlan.length, 2)
  assert.equal(parsed.rubric.length, 1)
  assert.deepEqual(parsed.verifyTopics, ["Georgia licensing requirements"])
  assert.equal(parsed.candidateHooks.length, 1)
})

test("caps are enforced: themes 6, clarifying 3, questions per theme 4, hooks 4", () => {
  const raw = {
    themes: Array.from({ length: 9 }, (_, i) => theme(i)),
    clarifyingQuestions: ["a?", "b?", "c?", "d?", "e?"],
    questionPlan: [
      {
        theme: "Theme 0",
        questions: Array.from({ length: 7 }, (_, i) => ({ question: `q${i}`, followUp: "f" })),
      },
    ],
    rubric: [],
    verifyTopics: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"],
    candidateHooks: ["h1", "h2", "h3", "h4", "h5", "h6"],
  }
  const parsed = parseBlueprint(raw)
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 6)
  assert.equal(parsed.clarifyingQuestions.length, 3)
  assert.equal(parsed.questionPlan[0].questions.length, 4)
  assert.equal(parsed.verifyTopics.length, 6)
  assert.equal(parsed.candidateHooks.length, 4)
})

test("plan and rubric entries for unknown themes are dropped", () => {
  const parsed = parseBlueprint({
    ...validRaw,
    questionPlan: [planEntry(1), { theme: "Invented theme", questions: planEntry(1).questions }],
    rubric: [{ theme: "Invented theme", strong: "s", weak: "w" }],
  })
  assert.ok(parsed)
  assert.equal(parsed.questionPlan.length, 1)
  assert.equal(parsed.rubric.length, 0)
})

test("malformed output is rejected, never partially accepted", () => {
  assert.equal(parseBlueprint(null), null)
  assert.equal(parseBlueprint("nonsense"), null)
  assert.equal(parseBlueprint({ themes: [] }), null)
  // Themes without a single planned question cannot run an interview.
  assert.equal(parseBlueprint({ ...validRaw, questionPlan: [] }), null)
  assert.equal(parseBlueprint({ ...validRaw, themes: [{ title: "no detail" }] }), null)
})

test("junk entries inside arrays are skipped, not fatal", () => {
  const parsed = parseBlueprint({
    ...validRaw,
    themes: [theme(1), 42, { title: "", detail: "x" }, theme(2)],
    clarifyingQuestions: [null, "Real question?", 7],
    verifyTopics: [null, "Real topic", { nested: true }],
  })
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 2)
  assert.deepEqual(parsed.clarifyingQuestions, [{ question: "Real question?" }])
  assert.deepEqual(parsed.verifyTopics, ["Real topic"])
})

test("status is awaiting-input only while a clarifying question lacks an answer", () => {
  assert.equal(blueprintStatusFor([]), "ready")
  assert.equal(blueprintStatusFor([{ question: "q?" }]), "awaiting-input")
  assert.equal(blueprintStatusFor([{ question: "q?", answer: "a" }]), "ready")
})

const base: Blueprint = {
  status: "ready",
  themes: [theme(1)],
  clarifyingQuestions: [],
  questionPlan: [planEntry(1)],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
}

test("claims collapse concurrent triggers and respect force, mirroring the audit", () => {
  assert.equal(canClaimBlueprint(null, false), true)
  assert.equal(canClaimBlueprint({ ...base, status: "generating" }, false), false)
  assert.equal(canClaimBlueprint({ ...base, status: "generating" }, true), false)
  assert.equal(canClaimBlueprint({ ...base, status: "failed" }, false), true)
  assert.equal(canClaimBlueprint(base, false), false)
  assert.equal(canClaimBlueprint(base, true), true)
  assert.equal(canClaimBlueprint({ ...base, status: "awaiting-input" }, false), false)
})

test("a pending refinement is claimable without force; a completed one is not", () => {
  const pending = {
    ...base,
    refinement: { removedThemes: [], redirectNote: "less system design", completed: false },
  }
  assert.equal(canClaimBlueprint(pending, false), true)
  const done = { ...pending, refinement: { ...pending.refinement, completed: true } }
  assert.equal(canClaimBlueprint(done, false), false)
})

test("refinement can be requested exactly once", () => {
  assert.equal(canRequestRefinement(base), true)
  assert.equal(canRequestRefinement({ ...base, status: "awaiting-input" }), true)
  assert.equal(canRequestRefinement({ ...base, status: "generating" }), false)
  assert.equal(canRequestRefinement({ ...base, status: "failed" }), false)
  assert.equal(
    canRequestRefinement({
      ...base,
      refinement: { removedThemes: [], redirectNote: "", completed: true },
    }),
    false
  )
  assert.equal(
    canRequestRefinement({
      ...base,
      refinement: { removedThemes: [], redirectNote: "", completed: false },
    }),
    false
  )
})
