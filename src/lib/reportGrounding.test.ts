import test from "node:test"
import assert from "node:assert/strict"
import { groundHeldUp, MAX_HELD_UP } from "./reportGrounding.ts"

const FOUNDER_TURNS = [
  "We have 12 pilot customers in logistics and a waitlist of 40 companies, all inbound from one conference talk.",
  "Our route predictions hit 94 percent accuracy on the pilot data, measured weekly against actual delivery times.",
  "Um, yeah, so it's kind of a mapping thing. We're still figuring out the details honestly.",
]

test("a finding quoting verbatim founder speech survives", () => {
  const result = groundHeldUp(
    [
      {
        finding: "12 paying-pilot traction with inbound demand",
        quote: "We have 12 pilot customers in logistics and a waitlist of 40 companies",
      },
    ],
    FOUNDER_TURNS
  )
  assert.equal(result.length, 1)
  assert.equal(result[0].finding, "12 paying-pilot traction with inbound demand")
})

test("a fabricated finding with an invented quote is dropped", () => {
  // The observed bug: recommendations the founder never said, presented as
  // things that "held up".
  const result = groundHeldUp(
    [
      {
        finding: "Prove enterprise-readiness with documented load tests and SLOs to unlock $500M+ buyers",
        quote: "We serve $500M+ enterprise buyers with documented SLOs",
      },
      {
        finding: "Define accuracy benchmarks to differentiate Cartograph",
        quote: "Our precision and recall benchmarks differentiate us",
      },
    ],
    FOUNDER_TURNS
  )
  assert.deepEqual(result, [])
})

test("paraphrase is not a quote — one changed word fails", () => {
  const result = groundHeldUp(
    [
      {
        finding: "Strong pilot accuracy",
        quote: "Our route predictions hit 95 percent accuracy on the pilot data",
      },
    ],
    FOUNDER_TURNS
  )
  assert.deepEqual(result, [])
})

test("cosmetic edits still match: case, punctuation, curly quotes, whitespace", () => {
  const result = groundHeldUp(
    [
      {
        finding: "Measured accuracy discipline",
        quote: "our route predictions hit 94 percent accuracy on the pilot data,   measured weekly…",
      },
      {
        finding: "Early honesty about maturity",
        quote: "We’re still figuring out the details honestly",
      },
    ],
    FOUNDER_TURNS
  )
  assert.equal(result.length, 2)
})

test("a trivial quote grounds nothing", () => {
  const result = groundHeldUp(
    [{ finding: "Founder agreed enthusiastically", quote: "yeah, so" }],
    ["Yeah, so."]
  )
  assert.deepEqual(result, [])
})

test("quotes from panelist speech do not ground a finding", () => {
  // Panelist turns are never passed in — quoting the panel fails the check.
  const result = groundHeldUp(
    [
      {
        finding: "Enterprise buyers will test accuracy",
        quote: "Logistics buyers will test you",
      },
    ],
    FOUNDER_TURNS
  )
  assert.deepEqual(result, [])
})

test("empty founder speech grounds nothing", () => {
  const result = groundHeldUp(
    [{ finding: "Anything", quote: "Anything at all here" }],
    []
  )
  assert.deepEqual(result, [])
})

test("malformed model output yields zero findings, not a crash", () => {
  assert.deepEqual(groundHeldUp(undefined, FOUNDER_TURNS), [])
  assert.deepEqual(groundHeldUp("not an array", FOUNDER_TURNS), [])
  assert.deepEqual(groundHeldUp([{ finding: 42 }, { quote: "no finding" }, null], FOUNDER_TURNS), [])
})

test("candidates are capped at MAX_HELD_UP", () => {
  const candidates = Array.from({ length: MAX_HELD_UP + 3 }, (_, i) => ({
    finding: `Finding ${i}`,
    quote: "We have 12 pilot customers in logistics",
  }))
  const result = groundHeldUp(candidates, FOUNDER_TURNS)
  assert.equal(result.length, MAX_HELD_UP)
})
