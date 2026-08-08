import test from "node:test"
import assert from "node:assert/strict"
import { analyzeSystem, analyzeUser, audit, orchestrate, report } from "./prompts.ts"
import type { Scope } from "../types.ts"

// Pin tests for the audit-lane prompts. Two lines are load-bearing above
// all others: safeguards come only from the injected catalog, and every
// output is practice feedback, never a compliance determination.

const scope: Scope = {
  systemName: "CourtTime production",
  description: "SaaS on AWS, one region, five engineers",
  role: "DevOps lead who owns backups",
  controlArea: "Data Recovery (Control 11)",
  concerns: ["Recovery testing"],
}

test("analyze extracts the six context fields and stays in practice framing", () => {
  assert.match(
    analyzeSystem,
    /environmentProfile, controlOwnership, evidencePosture, riskiestArea, likelyFindings, openQuestions/
  )
  assert.match(analyzeSystem, /practice preparation, not a compliance determination/)
  assert.match(analyzeSystem, /phrased as a real question ending with a question mark/)
  const user = analyzeUser(scope)
  assert.match(user, /Being assessed: CourtTime production/)
  assert.match(user, /Safeguard 11\.2/)
})

test("audit injects only the in-scope safeguards and forbids outside citations", () => {
  const prompt = audit({ scope, unreadableCount: 0, materialSections: "=== runbook.pdf ===" })
  assert.match(prompt, /Safeguard 11\.1 \(IG1\)/)
  assert.match(prompt, /Safeguard 11\.5 \(IG2\)/)
  assert.doesNotMatch(prompt, /Safeguard 5\.1/)
  assert.match(prompt, /never cite any other framework, standard, control, or safeguard number/)
  assert.match(prompt, /few or zero claims is the correct answer — do not invent/)
  assert.match(prompt, /\{"claims":\[\{"text","source","location","axis"\}\]/)
})

test("an unrecognized control area falls back to Data Recovery", () => {
  const prompt = audit({
    scope: { ...scope, controlArea: "" },
    unreadableCount: 0,
    materialSections: "x",
  })
  assert.match(prompt, /Data Recovery \(Control 11\)/)
})

test("orchestrate keeps the four axes, the score echo, and the rules", () => {
  const prompt = orchestrate({
    characterName: "Priya Nair",
    characterRole: "Lead Security Assessor",
    characterTone: "Methodical",
    scope,
    current: { process: 55, evidence: 50, command: 45, cadence: 60 },
  })
  assert.match(prompt, /alongside Priya Nair \(Lead Security Assessor\)/)
  assert.match(prompt, /process=55/)
  assert.match(prompt, /cadence=60/)
  assert.match(prompt, /return the CURRENT value UNCHANGED/)
  assert.match(prompt, /Never move by more than 10 points/)
  assert.match(prompt, /"riskScores":\{"process":int,"evidence":int,"command":int,"cadence":int\}/)
})

test("report keeps the closed verdicts, the language rule, and the grounding rules", () => {
  const prompt = report({
    scope,
    characterName: "Priya Nair",
    characterRole: "Lead Security Assessor",
    characterTone: "Methodical",
    notes: "(none)",
    transcript: "AUDITEE: hello",
    continuity: null,
  })
  assert.match(prompt, /"decision": "ready" \| "shaky" \| "not-ready"/)
  assert.match(prompt, /Never state or imply a compliance determination/)
  assert.match(prompt, /never cite any other framework, standard, control, or safeguard number/)
  assert.match(prompt, /verbatim words in "quote"/)
  assert.match(prompt, /an empty list is the correct, honest output/)
  assert.match(prompt, /\{"day": 7, "task"/)
})

test("report compounds the engagement memory and forbids repeating tracked commitments", () => {
  const prompt = report({
    scope,
    characterName: "Priya Nair",
    characterRole: "Lead Security Assessor",
    characterTone: "Methodical",
    notes: "(none)",
    transcript: "AUDITEE: hello",
    continuity: {
      summary: "Backup schedule proven; recovery test report still missing.",
      open: ["Produce the last recovery test report"],
      delivered: ["Share the backup schedule configuration"],
    },
  })
  assert.match(prompt, /Previous summary: Backup schedule proven; recovery test report still missing\./)
  assert.match(prompt, /open: Produce the last recovery test report/)
  assert.match(prompt, /UPDATE the previous summary rather than writing a fresh one/)
  assert.match(prompt, /never repeat or rephrase a commitment already tracked/)
})
