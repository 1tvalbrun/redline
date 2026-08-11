import test from "node:test"
import assert from "node:assert/strict"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"
import { salesPack } from "./pack.ts"
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

test("extractScope keeps the honesty rule and never invents", () => {
  const prompt = extractScope({ source: "voice", pitch: "We sell CourtFlow." })
  assert.match(prompt, /THE HONESTY RULE: extract ONLY what the seller actually said/)
  assert.match(prompt, /Never infer, never fill in plausible content/)
  assert.match(prompt, /A missing answer is valuable information/)
  assert.match(prompt, /Never use an em dash in any output value/)
  assert.match(prompt, /spoken pitch transcript/)
  assert.match(prompt, /We sell CourtFlow\./)
  assert.match(extractScope({ source: "deck", pitch: "p" }), /pitch deck text/)
})

test("extractScope asks for exactly the pack's scope-field keys and chip labels", () => {
  const prompt = extractScope({ source: "voice", pitch: "x" })
  for (const field of salesPack.scopeFields) {
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

test("no extractBrief on the pack, and tellIt copy stands in for intake, em dash free", () => {
  assert.ok(!("extractBrief" in salesPack.prompts))
  assert.ok(!("intake" in salesPack.copy))
  assert.equal(salesPack.copy.tellIt.heading, "What are you selling?")
  assert.ok(!salesPack.copy.tellIt.sub.includes("—"))
})

test("audit keeps the evidence split and the citation contract", () => {
  const prompt = audit({ scope, unreadableCount: 1, materialSections: "=== one-pager.pdf ===" })
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
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm but immovable",
    scope,
  })
  assert.match(prompt, /alongside Cole Merritt \(Director of Operations\)/)
  assert.match(prompt, /strong_answer: seller gave a sharp, specific answer/)
  assert.match(prompt, /name the topic being discussed right now, in 5 words or fewer/)
  assert.match(prompt, /"topic":"<5 words or fewer>" \| null/)
  assert.doesNotMatch(prompt, /riskScores/)
  assert.doesNotMatch(prompt, /0-100/)
})

test("orchestrate carries the objection catalog probes", () => {
  const prompt = orchestrate({
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm",
    scope,
  })
  assert.match(prompt, /Switching cost: "Ripping out the current process/)
  assert.match(prompt, /Decision authority: /)
})

test("debrief keeps the grounding rules and the new contract, without scores", () => {
  const prompt = debrief({
    scope,
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm but immovable",
    notes: "(none)",
    transcript: "SELLER: hello",
    continuity: null,
  })
  assert.match(prompt, /"decision": "buy" \| "second-meeting" \| "walk"/)
  assert.match(prompt, /"title": /)
  assert.match(prompt, /"spokenVerdict": /)
  assert.match(prompt, /"whatHappened": /)
  assert.match(prompt, /"heldUp": \[/)
  assert.match(prompt, /"didntHold": \[/)
  assert.match(prompt, /"continuity": \{/)
  assert.match(prompt, /"priority": "high" \| "medium" \| "low"/)
  assert.match(prompt, /copied verbatim/)
  assert.match(prompt, /an empty list is the correct, honest output/)
  assert.match(prompt, /"send me some info" is not a next step/)
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
    characterName: "Cole Merritt",
    characterRole: "Director of Operations",
    characterTone: "Warm",
    notes: "(none)",
    transcript: "SELLER: hello",
    continuity: {
      summary: "Pilot agreed in principle; price unresolved.",
      open: ["Share a one-page draft pilot scope"],
      delivered: ["Send two operator references"],
    },
  })
  assert.match(prompt, /Previous summary: Pilot agreed in principle; price unresolved\./)
  assert.match(prompt, /open: Share a one-page draft pilot scope/)
  assert.match(prompt, /delivered: Send two operator references/)
  assert.match(prompt, /UPDATE the previous summary rather than writing a fresh one/)
  assert.match(prompt, /never repeat or rephrase a commitment already tracked/)
})
