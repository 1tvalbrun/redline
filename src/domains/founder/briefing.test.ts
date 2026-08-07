import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import type { Claim, Gap } from "../../lib/audit.ts"

const gap = (title: string, axis: Gap["axis"], severity: Gap["severity"] = "blocker"): Gap => ({
  severity,
  kind: "absent",
  title,
  detail: "detail",
  axis,
})

const claim = (axis: Claim["axis"]): Claim => ({
  text: "claim",
  citation: { source: "deck.pdf", location: "page 1" },
  axis,
})

test("a fresh session opens on the weakest audit axis and carries the gaps", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "Inventory forecasting for pharmacies" },
    audit: {
      claims: [claim("market")],
      gaps: [gap("No accuracy methodology", "technical"), gap("No pricing evidence", "gtm", "gap")],
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /technical/i)
  assert.match(briefing.personalityPreamble, /No accuracy methodology/)
  assert.match(briefing.personalityPreamble, /Acme/)
})

test("a fresh session with no audit still opens, without inventing findings", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: null,
    transcript: [],
  })
  assert.match(briefing.startScript, /Acme/)
  assert.doesNotMatch(briefing.personalityPreamble, /audit flagged/)
})

test("a resume never re-introduces and digests turns in speech order", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: null,
    transcript: [
      // Arrival order reversed from speech order — digest must sort by spokenAt.
      { text: "Answer about churn", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "What is your churn?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  const questionAt = briefing.personalityPreamble.indexOf("What is your churn?")
  const answerAt = briefing.personalityPreamble.indexOf("Answer about churn")
  assert.ok(questionAt !== -1 && answerAt !== -1 && questionAt < answerAt)
  assert.match(briefing.startScript, /pick up right where we left off/)
})

test("the digest keeps only the most recent turns", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: null,
    transcript: Array.from({ length: 7 }, (_, i) => ({
      text: `turn-${i}`,
      type: "user" as const,
      timestamp: i,
      spokenAt: i,
    })),
  })
  assert.doesNotMatch(briefing.personalityPreamble, /turn-0/)
  assert.match(briefing.personalityPreamble, /turn-6/)
})

test("a blocker outranks earlier plain gaps in the briefing", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: {
      claims: [],
      gaps: [
        gap("Plain gap A", "market", "gap"),
        gap("Plain gap B", "market", "gap"),
        gap("Plain gap C", "market", "gap"),
        gap("The blocker", "technical"),
      ],
    },
    transcript: [],
  })
  assert.match(briefing.personalityPreamble, /The blocker/)
})

test("long turns are truncated in the digest", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: null,
    transcript: [{ text: "x".repeat(500), type: "user", timestamp: 1, spokenAt: 1 }],
  })
  assert.ok(!briefing.personalityPreamble.includes("x".repeat(200)))
})

test("an audit with nothing citable opens on the weakest axis without claiming to have read materials", () => {
  const briefing = buildRoomBriefing({
    scope: { ideaName: "Acme", description: "desc" },
    audit: { claims: [], gaps: [gap("No accuracy methodology", "technical")] },
    transcript: [],
  })
  assert.match(briefing.startScript, /technical/i)
  assert.doesNotMatch(briefing.startScript, /materials/)
})
