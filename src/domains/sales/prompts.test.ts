import test from "node:test"
import assert from "node:assert/strict"
import { analyzeSystem, analyzeUser, audit, orchestrate, report } from "./prompts.ts"
import type { Scope } from "../types.ts"

// Pin tests for the sales prompts, written with the pack. They hold the
// load-bearing lines (grounding rules, JSON contracts, the closed verdict
// vocabulary) in place; a failure means the prompt changed, which should
// only ever happen deliberately.

const scope: Scope = {
  offering: "CourtFlow",
  description: "Scheduling for shared gym space",
  prospect: "Facilities manager at a mid-size gym",
  ask: "A pilot",
  objections: ["Switching cost", "Price"],
}

test("analyze extracts the seven context fields from the scope", () => {
  assert.match(
    analyzeSystem,
    /coreOffer, buyerProfile, valueProposition, pricingShape, riskiestAssumption, likelyObjections, openQuestions/
  )
  assert.match(analyzeSystem, /say plainly what is missing rather than inventing content/)
  const user = analyzeUser(scope)
  assert.match(user, /Offering: CourtFlow/)
  assert.match(user, /Expected objections: Switching cost, Price/)
})

test("audit keeps the evidence split, the axis set, and the citation contract", () => {
  const prompt = audit({ scope, unreadableCount: 1, materialSections: "=== one-pager.pdf ===" })
  assert.match(prompt, /their own words, NOT evidence/)
  assert.match(prompt, /the ONLY citable evidence/)
  assert.match(prompt, /"value" \(problem severity, quantified payoff, ROI\)/)
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
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm but immovable",
    scope,
    current: { value: 55, fit: 50, objections: 45, close: 60 },
  })
  assert.match(prompt, /alongside Cole Merritt \(Director of Operations\)/)
  assert.match(prompt, /value=55/)
  assert.match(prompt, /close=60/)
  assert.match(prompt, /return the CURRENT value UNCHANGED/)
  assert.match(prompt, /Never move by more than 10 points/)
  assert.match(prompt, /"riskScores":\{"value":int,"fit":int,"objections":int,"close":int\}/)
})

test("orchestrate carries the objection catalog probes", () => {
  const prompt = orchestrate({
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm",
    scope,
    current: { value: 50, fit: 50, objections: 50, close: 50 },
  })
  assert.match(prompt, /Switching cost: "Ripping out the current process/)
  assert.match(prompt, /Decision authority: /)
})

test("report keeps the grounding rules and the closed verdict contract", () => {
  const prompt = report({
    scope,
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm but immovable",
    notes: "(none)",
    transcript: "SELLER: hello",
  })
  assert.match(prompt, /"decision": "buy" \| "second-meeting" \| "walk"/)
  assert.match(prompt, /verbatim words in "quote"/)
  assert.match(prompt, /an empty list is the correct, honest output/)
  assert.match(prompt, /belong ONLY in "nextSevenDays", never in "heldUp"/)
  assert.match(prompt, /"send me some info" is not a next step/)
  assert.match(prompt, /\{"day": 7, "task"/)
})
