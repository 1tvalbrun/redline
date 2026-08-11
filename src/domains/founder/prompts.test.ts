import test from "node:test"
import assert from "node:assert/strict"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"
import { founderPack } from "./pack.ts"
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

test("extractScope keeps the honesty rule and never invents", () => {
  const prompt = extractScope({ source: "voice", pitch: "We build Acme." })
  assert.match(prompt, /THE HONESTY RULE: extract ONLY what the founder actually said/)
  assert.match(prompt, /Never infer, never fill in plausible content/)
  assert.match(prompt, /A missing answer is valuable information/)
  assert.match(prompt, /Never use an em dash in any output value/)
  assert.match(prompt, /spoken pitch transcript/)
  assert.match(prompt, /We build Acme\./)
  assert.match(extractScope({ source: "deck", pitch: "p" }), /pitch deck text/)
})

test("extractScope asks for exactly the pack's scope-field keys and chip labels", () => {
  const prompt = extractScope({ source: "voice", pitch: "x" })
  for (const field of founderPack.scopeFields) {
    assert.ok(prompt.includes(`"${field.key}"`), `missing key ${field.key}`)
    for (const option of field.options ?? []) {
      assert.ok(prompt.includes(`"${option.label}"`), `missing label ${option.label}`)
    }
  }
})

test("extractScope clamps the pitch to its char budget", () => {
  const prompt = extractScope({ source: "voice", pitch: "y".repeat(20_000) })
  assert.ok(!prompt.includes("y".repeat(12_001)))
})

test("extractBrief is gone and tellIt copy stands in for intake, em dash free", () => {
  assert.ok(!("extractBrief" in founderPack.prompts))
  assert.ok(!("intake" in founderPack.copy))
  assert.equal(founderPack.copy.tellIt.heading, "What are you building?")
  assert.ok(!founderPack.copy.tellIt.sub.includes("—"))
})

test("audit keeps the evidence split and the citation contract", () => {
  const prompt = audit({ scope, unreadableCount: 1, materialSections: "=== deck.pdf ===" })
  assert.match(prompt, /their own words, NOT evidence/)
  assert.match(prompt, /the ONLY citable evidence/)
  assert.match(prompt, /few or zero claims is the correct answer — do not invent/)
  assert.match(prompt, /1 uploaded file\(s\) could not be read/)
  assert.match(prompt, /\{"claims":\[\{"text","source","location"\}\]/)
  assert.doesNotMatch(prompt, /axis/)
})

test("audit omits the unreadable-files line when everything was read", () => {
  const prompt = audit({ scope, unreadableCount: 0, materialSections: "x" })
  assert.doesNotMatch(prompt, /could not be read/)
})

test("orchestrate asks for a note and a topic, never scores", () => {
  const prompt = orchestrate({
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    scope,
  })
  assert.match(prompt, /alongside Victoria Chen \(Partner\)/)
  assert.match(prompt, /strong_answer: founder gave a sharp, specific answer/)
  assert.match(prompt, /name the topic being discussed right now, in 5 words or fewer/)
  assert.match(prompt, /"topic":"<5 words or fewer>" \| null/)
  assert.doesNotMatch(prompt, /riskScores/)
  assert.doesNotMatch(prompt, /0-100/)
})

test("debrief keeps the grounding rules and the new contract, without scores", () => {
  const prompt = debrief({
    scope,
    characterName: "Victoria Chen",
    characterRole: "Partner",
    characterTone: "Sharp",
    notes: "(none)",
    transcript: "FOUNDER: hello",
    continuity: null,
  })
  assert.match(prompt, /"decision": "advance" \| "iterate" \| "pass"/)
  assert.match(prompt, /"title": /)
  assert.match(prompt, /"spokenVerdict": /)
  assert.match(prompt, /"whatHappened": /)
  assert.match(prompt, /"heldUp": \[/)
  assert.match(prompt, /"didntHold": \[/)
  assert.match(prompt, /"continuity": \{/)
  assert.match(prompt, /"priority": "high" \| "medium" \| "low"/)
  assert.match(prompt, /copied verbatim/)
  assert.match(prompt, /an empty list is the correct, honest output/)
  assert.match(prompt, /never invent a commitment/)
  assert.doesNotMatch(prompt, /overallScore/)
  assert.doesNotMatch(prompt, /riskScores/)
  assert.doesNotMatch(prompt, /panelVerdict/)
  assert.doesNotMatch(prompt, /nextSevenDays/)
  assert.doesNotMatch(prompt, /topRisks/)
})

test("debrief compounds the engagement memory and forbids repeating tracked commitments", () => {
  const prompt = debrief({
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
  const prompt = debrief({
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
