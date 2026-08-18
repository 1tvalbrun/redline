import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import { PREAMBLE_BUDGET } from "../types.ts"
import type { Blueprint } from "../../lib/blueprint.ts"

const scope = {
  roleTitle: "ICU Nurse",
  interviewType: "Behavioral",
  seniority: "Senior",
  industryContext: "regional hospital ICU",
  focusAreas: ["Ownership"],
}

const makeBlueprint = (overrides: Partial<Blueprint> = {}): Blueprint => ({
  status: "ready",
  themes: [{ title: "Patient escalation", detail: "How they escalate under pressure" }],
  clarifyingQuestions: [],
  questionPlan: [
    {
      theme: "Patient escalation",
      questions: [
        { question: "Tell me about a night the unit was short-staffed", followUp: "Their call" },
        { question: "When did you last override a protocol?", followUp: "Why" },
        { question: "A third question that never makes the compressed plan", followUp: "x" },
      ],
    },
  ],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
  ...overrides,
})

test("a fresh session frames the role and works from the question plan", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.personalityPreamble, /interviewing a candidate for "ICU Nurse"/)
  assert.match(briefing.personalityPreamble, /Senior/)
  assert.match(briefing.personalityPreamble, /regional hospital ICU/)
  assert.match(briefing.personalityPreamble, /short-staffed/)
  // Compressed plan: only the first two questions per theme survive.
  assert.doesNotMatch(briefing.personalityPreamble, /third question/)
  assert.match(briefing.startScript, /tell me about yourself/i)
})

test("a session without a usable blueprint still frames the role and never mentions a plan", () => {
  const failed = makeBlueprint({ status: "failed" })
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: failed,
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.personalityPreamble, /ICU Nurse/)
  assert.doesNotMatch(briefing.personalityPreamble, /question plan/i)
  assert.doesNotMatch(briefing.startScript, /your background/)
})

test("honest scoping appears exactly when verifyTopics is non-empty, above candidate hooks", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint({
      verifyTopics: ["Georgia nursing license renewal"],
      candidateHooks: ["Led the Epic migration"],
    }),
    continuity: null,
    transcript: [],
  })
  const scopingAt = briefing.personalityPreamble.indexOf("Georgia nursing license renewal")
  const hooksAt = briefing.personalityPreamble.indexOf("Led the Epic migration")
  assert.ok(scopingAt !== -1)
  assert.ok(hooksAt !== -1)
  assert.ok(scopingAt < hooksAt)
  const clean = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [],
  })
  assert.doesNotMatch(clean.personalityPreamble, /never state statutes/i)
})

test("under budget pressure, sections drop whole from the back: hooks go before scoping", () => {
  const longPlan = makeBlueprint({
    themes: Array.from({ length: 6 }, (_, i) => ({ title: `Theme ${i}`, detail: "d" })),
    questionPlan: Array.from({ length: 6 }, (_, i) => ({
      theme: `Theme ${i}`,
      questions: [
        { question: `Q${i}A ${"x".repeat(220)}`, followUp: "f" },
        { question: `Q${i}B ${"x".repeat(220)}`, followUp: "f" },
      ],
    })),
    verifyTopics: ["Georgia nursing license renewal", "Compact state rules"],
    candidateHooks: Array.from({ length: 4 }, (_, i) => `Hook ${i} ${"y".repeat(140)}`),
  })
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: longPlan,
    continuity: null,
    transcript: [],
  })
  // Sanity: the full section set genuinely exceeds the budget…
  assert.ok(briefing.personalityPreamble.length <= PREAMBLE_BUDGET + 2)
  // …the plan and the scoping survive, the hooks dropped whole.
  assert.match(briefing.personalityPreamble, /Q0A/)
  assert.match(briefing.personalityPreamble, /Georgia nursing license renewal/)
  assert.doesNotMatch(briefing.personalityPreamble, /Hook 0/)
})

test("a resume digests recent turns in speech order and never re-introduces", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [
      { text: "My answer about escalation", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "How do you escalate?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  const questionAt = briefing.personalityPreamble.indexOf("How do you escalate?")
  const answerAt = briefing.personalityPreamble.indexOf("My answer about escalation")
  assert.ok(questionAt !== -1 && answerAt !== -1 && questionAt < answerAt)
  assert.match(briefing.startScript, /pick it up wherever you left it/i)
})

test("open commitments drive the opener and forbid re-introduction", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: {
      lastSessionSummary: "Conflict stories still borrow the team's work.",
      actionItems: [
        {
          id: "s1:0",
          text: "Prepare a second conflict story",
          priority: "high" as const,
          status: "open" as const,
          createdAt: 1,
        },
      ],
      updatedAt: 1,
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /last time you said you'd prepare a second conflict story/i)
  assert.match(briefing.personalityPreamble, /do not introduce yourself/i)
  assert.match(briefing.personalityPreamble, /borrow the team's work/)
})
