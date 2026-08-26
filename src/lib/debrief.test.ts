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

test("an overlong action item clamps at a word boundary with an ellipsis, never mid-word", () => {
  const text = `Provide the MFA enforcement screenshots and configuration ${"evidence ".repeat(30)}`
  const result = parseDebrief(
    { ...FULL, continuity: { summary: "x", actionItems: [{ text, priority: "high" }] } },
    OPTS
  )
  const clamped = result.continuity.actionItems[0].text
  assert.ok(clamped.length <= 200, `expected ≤ 200 chars, got ${clamped.length}`)
  assert.ok(clamped.endsWith("…"), `expected trailing ellipsis, got: ${clamped.slice(-20)}`)
  // Everything before the ellipsis is whole words from the original: the
  // body is a prefix of the source and the cut landed on a space.
  const body = clamped.slice(0, -1)
  assert.ok(text.startsWith(body))
  assert.ok(!body.endsWith(" "))
  assert.equal(text[body.length], " ")
})

test("an action item under the 200-char cap survives whole", () => {
  const text =
    "Provide the disable timestamp record for the recent leaver, matched to the documented revocation process with audit trails intact and the ticket reference attached".slice(0, 162)
  const result = parseDebrief(
    { ...FULL, continuity: { summary: "x", actionItems: [{ text, priority: "high" }] } },
    OPTS
  )
  assert.equal(result.continuity.actionItems[0].text, text)
})

test("string-shaped action items are currently dropped (documents the suspected bug)", () => {
  const result = parseDebrief(
    { ...FULL, continuity: { summary: "x", actionItems: ["Bring the automated test plan"] } },
    OPTS
  )
  // If this assertion ever needs flipping to length 1, the parser was
  // widened to accept bare strings — update deliberately.
  assert.equal(result.continuity.actionItems.length, 0)
})

test("didntHold entries without ref omit it", () => {
  const result = parseDebrief(
    { ...FULL, didntHold: [{ text: "No pricing answer." }] },
    OPTS
  )
  assert.deepEqual(result.didntHold, [{ text: "No pricing answer." }])
})

test("verifyItems are accepted, capped at 4, and clamped", () => {
  const parsed = parseDebrief(
    {
      verdict: { decision: "second-meeting", summary: "s" },
      verifyItems: [
        { text: "Confirm Georgia licensing requirements with the state board" },
        { text: "x".repeat(400) },
        { text: "third" },
        { text: "fourth" },
        { text: "fifth never survives the cap" },
        "junk entry",
      ],
    },
    {
      verdictValues: ["buy", "second-meeting", "walk"],
      fallbackVerdict: "second-meeting",
      lowestVerdict: "walk",
      userTurns: ["enough words to clear the participation floor ".repeat(3)],
    }
  )
  assert.equal(parsed.verifyItems.length, 4)
  assert.equal(
    parsed.verifyItems[0].text,
    "Confirm Georgia licensing requirements with the state board"
  )
  assert.equal(parsed.verifyItems[1].text.length, 200)
})

test("a debrief without verifyItems parses to an empty list", () => {
  const parsed = parseDebrief(
    { verdict: { decision: "walk", summary: "s" } },
    {
      verdictValues: ["buy", "second-meeting", "walk"],
      fallbackVerdict: "second-meeting",
      lowestVerdict: "walk",
      userTurns: ["enough words to clear the participation floor ".repeat(3)],
    }
  )
  assert.deepEqual(parsed.verifyItems, [])
})
