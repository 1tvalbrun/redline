import test from "node:test"
import assert from "node:assert/strict"
import {
  analyzeSystem,
  blueprint,
  debrief,
  extractScope,
  orchestrate,
  refineBlueprint,
} from "./prompts.ts"
import type { Blueprint } from "../../lib/blueprint.ts"

const scope = {
  roleTitle: "Engineering Manager, frontend teams",
  interviewType: "Behavioral",
  seniority: "Senior",
  industryContext: "state-licensed health insurance sales in Georgia",
  focusAreas: ["Ownership", "Conflict"],
  jobPosting: "We are hiring an EM to lead two squads.",
}

const madeBlueprint: Blueprint = {
  status: "ready",
  themes: [{ title: "Team conflict", detail: "How they handle disagreement" }],
  clarifyingQuestions: [{ question: "IC or manager track?", answer: "Manager" }],
  questionPlan: [
    {
      theme: "Team conflict",
      questions: [{ question: "Tell me about a real conflict", followUp: "What did YOU do" }],
    },
  ],
  rubric: [{ theme: "Team conflict", strong: "Names their own role", weak: "Blames the team" }],
  verifyTopics: ["Georgia licensing requirements"],
  candidateHooks: ["Led the platform migration"],
}

test("the blueprint prompt carries the honest-scoping backstop and the JSON contract", () => {
  const prompt = blueprint({ scope, unreadableCount: 0, materialSections: "(none)" })
  assert.match(prompt, /never state statutes, state rules, licensing requirements, or exam content as fact/i)
  assert.match(prompt, /"themes"/)
  assert.match(prompt, /"clarifyingQuestions"/)
  assert.match(prompt, /"questionPlan"/)
  assert.match(prompt, /"rubric"/)
  assert.match(prompt, /"verifyTopics"/)
  assert.match(prompt, /"candidateHooks"/)
  assert.match(prompt, /zero is the normal answer/i)
  assert.match(prompt, /Engineering Manager, frontend teams/)
})

test("the refine prompt closes the question loop and honors removals", () => {
  const prompt = refineBlueprint({
    scope,
    blueprint: madeBlueprint,
    removedThemes: ["Team conflict"],
    redirectNote: "less system design, more people management",
  })
  assert.match(prompt, /"clarifyingQuestions":\s?\[\]/)
  assert.match(prompt, /there is no second round of questions/i)
  assert.match(prompt, /do not bring these back/i)
  assert.match(prompt, /less system design, more people management/)
  assert.match(prompt, /IC or manager track\?.*Manager/s)
  assert.match(prompt, /never state statutes, state rules, licensing requirements, or exam content as fact/i)
})

test("the orchestrator tracks prepared themes and keeps the calibration contract", () => {
  const prompt = orchestrate({
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    scope,
    themes: ["Team conflict", "Ownership"],
  })
  assert.match(prompt, /Team conflict/)
  assert.match(prompt, /Only when their own words demonstrably earn it/)
  assert.match(prompt, /"note"/)
})

test("the orchestrator stays silent about themes when there is no blueprint", () => {
  const prompt = orchestrate({
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    scope,
    themes: null,
  })
  assert.doesNotMatch(prompt, /prepared interview themes/i)
})

test("the debrief prompt enforces the verdict vocabulary, rubric, and verifyItems contract", () => {
  const prompt = debrief({
    scope,
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    notes: "(none)",
    transcript: "CANDIDATE: hello",
    continuity: null,
    blueprint: { rubric: madeBlueprint.rubric, verifyTopics: madeBlueprint.verifyTopics },
  })
  assert.match(prompt, /"move-forward" \| "on-the-fence" \| "not-yet"/)
  assert.match(prompt, /"verifyItems"/)
  assert.match(prompt, /Names their own role/)
  assert.match(prompt, /Georgia licensing requirements/)
  assert.match(prompt, /Torn between two tiers\? Choose the lower/)
  assert.match(prompt, /never repeat or rephrase a commitment already tracked/)
})

test("the debrief prompt stands without a blueprint", () => {
  const prompt = debrief({
    scope,
    characterName: "Jun Park",
    characterRole: "Recruiter",
    characterTone: "Fast",
    notes: "(none)",
    transcript: "CANDIDATE: hello",
    continuity: null,
    blueprint: null,
  })
  assert.doesNotMatch(prompt, /pre-declared rubric/i)
  assert.match(prompt, /"move-forward" \| "on-the-fence" \| "not-yet"/)
})

test("extraction is honest and never invents a job posting from speech", () => {
  const prompt = extractScope({ source: "voice", pitch: "I want to practice for a nursing interview" })
  assert.match(prompt, /extract ONLY what the candidate actually said/i)
  assert.match(prompt, /"jobPosting": always null/)
  assert.match(prompt, /"Screening call" \| "Behavioral" \| "Technical & scenarios" \| "Full loop \(mixed\)"/)
  assert.match(prompt, /nursing interview/)
})

test("analysis extracts only the declared context fields", () => {
  assert.match(analyzeSystem, /roleSummary, interviewShape, pressureAreas, riskiestGap, openQuestions/)
  assert.match(analyzeSystem, /ONLY on what the candidate provided/)
})
