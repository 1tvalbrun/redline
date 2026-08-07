import test from "node:test"
import assert from "node:assert/strict"
import { analyzeSystem, analyzeUser, audit, extractBrief, orchestrate, report } from "./prompts.ts"
import type { Scope } from "../types.ts"

// Pin tests for the founder prompts, written when the templates moved out of
// the Convex actions. They hold the load-bearing lines (grounding rules,
// JSON contracts, honesty rules) in place; a failure means the prompt
// changed, which should only ever happen deliberately.

const scope: Scope = {
  ideaName: "Acme",
  stage: "Pre-seed",
  description: "Inventory forecasting for pharmacies",
  targetUser: "SMB",
  businessModel: "SaaS",
  focusAreas: ["pricing"],
}

test("analyze extracts the seven context fields from the brief", () => {
  assert.match(
    analyzeSystem,
    /problem, targetCustomer, coreAssumption, revenueModel, primaryRisk, competitors, openQuestions/
  )
  const user = analyzeUser(scope)
  assert.match(user, /Idea: Acme/)
  assert.match(user, /Focus Areas: pricing/)
})

test("extractBrief keeps the honesty rule and the closed vocabularies", () => {
  const prompt = extractBrief({ source: "voice", pitch: "We build Acme." })
  assert.match(prompt, /THE HONESTY RULE: extract ONLY what the founder actually said/)
  assert.match(prompt, /Never infer, never fill in plausible content/)
  assert.match(prompt, /spoken pitch transcript/)
  assert.match(prompt, /We build Acme\./)
  assert.match(extractBrief({ source: "deck", pitch: "p" }), /pitch deck text/)
})

test("extractBrief clamps the pitch to its char budget", () => {
  const prompt = extractBrief({ source: "voice", pitch: "y".repeat(20_000) })
  assert.ok(!prompt.includes("y".repeat(12_001)))
})

test("audit keeps the evidence split, the axis set, and the citation contract", () => {
  const prompt = audit({ scope, unreadableCount: 1, materialSections: "=== deck.pdf ===" })
  assert.match(prompt, /their own words, NOT evidence/)
  assert.match(prompt, /the ONLY citable evidence/)
  assert.match(prompt, /"market" \(TAM, demand, timing\)/)
  assert.match(prompt, /few or zero claims is the correct answer — do not invent/)
  assert.match(prompt, /1 uploaded file\(s\) could not be read/)
  assert.match(prompt, /\{"claims":\[\{"text","source","location","axis"\}\]/)
})

test("audit omits the unreadable-files line when everything was read", () => {
  const prompt = audit({ scope, unreadableCount: 0, materialSections: "x" })
  assert.doesNotMatch(prompt, /could not be read/)
})

test("orchestrate keeps the four axes, the echo of current scores, and the rules", () => {
  const prompt = orchestrate({
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    scope,
    current: { market: 55, customer: 50, technical: 45, gtm: 60 },
  })
  assert.match(prompt, /alongside Victoria Chen \(Partner\)/)
  assert.match(prompt, /market=55/)
  assert.match(prompt, /gtm=60/)
  assert.match(prompt, /return the CURRENT value UNCHANGED/)
  assert.match(prompt, /Never move by more than 10 points/)
  assert.match(prompt, /"riskScores":\{"market":int,"customer":int,"technical":int,"gtm":int\}/)
})

test("report keeps the grounding rules and the verdict contract", () => {
  const prompt = report({
    scope,
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    notes: "(none)",
    transcript: "FOUNDER: hello",
    continuity: null,
  })
  assert.match(prompt, /"decision": "advance" \| "iterate" \| "pass"/)
  assert.match(prompt, /verbatim words in "quote"/)
  assert.match(prompt, /an empty list is the correct, honest output/)
  assert.match(prompt, /belong ONLY in "nextSevenDays", never in "heldUp"/)
  assert.match(prompt, /\{"day": 7, "task"/)
  assert.match(prompt, /"continuity": \{/)
  assert.match(prompt, /never invent a commitment/)
})

test("report compounds the engagement memory and forbids repeating tracked commitments", () => {
  const prompt = report({
    scope,
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    notes: "(none)",
    transcript: "FOUNDER: hello",
    continuity: {
      summary: "Pricing contested since session one.",
      open: ["Send the churn cohort data"],
      delivered: ["Ship the pilot agreement"],
    },
  })
  assert.match(prompt, /Previous summary: Pricing contested since session one\./)
  assert.match(prompt, /open: Send the churn cohort data/)
  assert.match(prompt, /delivered: Ship the pilot agreement/)
  assert.match(prompt, /UPDATE the previous summary rather than writing a fresh one/)
  assert.match(prompt, /never repeat or rephrase a commitment already tracked/)
})

test("a first session has no engagement block", () => {
  const prompt = report({
    scope,
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    notes: "(none)",
    transcript: "FOUNDER: hello",
    continuity: null,
  })
  assert.doesNotMatch(prompt, /The engagement so far/)
})
