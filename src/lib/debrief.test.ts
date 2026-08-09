import test from "node:test"
import assert from "node:assert/strict"
import { parseDebrief } from "./debrief.ts"

const OPTS = {
  verdictValues: ["pass", "iterate", "advance"],
  fallbackVerdict: "iterate",
  lowestVerdict: "pass",
  userTurns: [
    "The spring drill restored in 42 minutes and our RPO on that run was 24 hours",
    "I have the vault policy with me",
  ],
}

const FULL = {
  title: "Evidence on request",
  verdict: { decision: "advance", summary: "Operational capability shown." },
  spokenVerdict: "Bring me the record, not the reassurance.",
  whatHappened: "You confirmed the spring drill restore but produced no records.",
  heldUp: [
    { quote: "The spring drill restored in 42 minutes", why: "Specific and measured." },
  ],
  didntHold: [{ text: "No recovery test report produced.", ref: "11.5" }],
  continuity: {
    summary: "Records still outstanding.",
    actionItems: [{ text: "Pull the recovery test report", priority: "high" }],
  },
}

test("well-formed output passes through", () => {
  const result = parseDebrief(FULL, OPTS)
  assert.equal(result.title, "Evidence on request")
  assert.equal(result.verdict, "advance")
  assert.equal(result.verdictSummary, "Operational capability shown.")
  assert.equal(result.heldUp.length, 1)
  assert.equal(result.didntHold[0].ref, "11.5")
  assert.deepEqual(result.continuity.actionItems, [
    { text: "Pull the recovery test report", priority: "high" },
  ])
})

test("verdict outside the pack vocabulary falls back", () => {
  const result = parseDebrief({ ...FULL, verdict: { decision: "smash hit" } }, OPTS)
  assert.equal(result.verdict, "iterate")
  assert.equal(result.verdictSummary, "Verdict pending review.")
})

test("garbage input yields safe fallbacks, never throws", () => {
  const result = parseDebrief(null, OPTS)
  assert.equal(result.verdict, "iterate")
  assert.equal(result.title, "Session debrief")
  assert.ok(result.spokenVerdict.includes("iterate"))
  assert.deepEqual(result.heldUp, [])
  assert.deepEqual(result.didntHold, [])
  assert.deepEqual(result.continuity.actionItems, [])
})

test("heldUp quotes must be verbatim user speech", () => {
  const result = parseDebrief(
    {
      ...FULL,
      heldUp: [
        { quote: "The spring drill restored in 42 minutes", why: "Real." },
        { quote: "Our compliance program is fully mature", why: "Paraphrase — must drop." },
      ],
    },
    OPTS
  )
  assert.equal(result.heldUp.length, 1)
  assert.equal(result.heldUp[0].why, "Real.")
})

test("caps: items and lengths are bounded", () => {
  const result = parseDebrief(
    {
      ...FULL,
      spokenVerdict: "x".repeat(1000),
      didntHold: Array.from({ length: 10 }, (_, i) => ({ text: `gap ${i}` })),
      continuity: {
        summary: "y".repeat(5000),
        actionItems: Array.from({ length: 12 }, (_, i) => ({
          text: `item ${i}`,
          priority: "urgent",
        })),
      },
    },
    OPTS
  )
  assert.equal(result.spokenVerdict.length, 220)
  assert.equal(result.didntHold.length, 4)
  assert.equal(result.continuity.summary.length, 1200)
  assert.equal(result.continuity.actionItems.length, 5)
  // Unknown priority normalizes to medium rather than dropping the item.
  assert.equal(result.continuity.actionItems[0].priority, "medium")
})

test("silence can never rate above the lowest tier, whatever the model says", () => {
  const result = parseDebrief(FULL, { ...OPTS, userTurns: [] })
  assert.equal(result.verdict, "pass")
  assert.equal(result.verdictSummary, "The session ended with too little from you to assess.")
  assert.deepEqual(result.heldUp, [])
})

test("minimal participation is floored to the lowest tier", () => {
  const result = parseDebrief(FULL, { ...OPTS, userTurns: ["Hi, I'm building CourtTime."] })
  assert.equal(result.verdict, "pass")
})

test("the participation floor keeps a model verdict that already agrees", () => {
  const honest = { ...FULL, verdict: { decision: "pass", summary: "You said nothing." } }
  const result = parseDebrief(honest, { ...OPTS, userTurns: [] })
  assert.equal(result.verdict, "pass")
  // The model's own honest summary survives; only an inflated one is replaced.
  assert.equal(result.verdictSummary, "You said nothing.")
})

test("real participation leaves the model's verdict alone", () => {
  const result = parseDebrief(FULL, OPTS)
  assert.equal(result.verdict, "advance")
})

test("didntHold entries without ref omit it", () => {
  const result = parseDebrief(
    { ...FULL, didntHold: [{ text: "No pricing answer." }] },
    OPTS
  )
  assert.deepEqual(result.didntHold, [{ text: "No pricing answer." }])
})
