import test from "node:test"
import assert from "node:assert/strict"
import {
  boundRiskDelta,
  deriveReadiness,
  readinessSeverity,
  selectVerdictSpeaker,
} from "./readiness.ts"

// The machinery is axis-agnostic; these tests exercise it with the founder
// lane's shape (four axes, buyer owns customer + gtm).
const AXES = ["market", "customer", "technical", "gtm"]
const OWNERS: Record<string, string> = {
  market: "vc-01",
  customer: "tc-01",
  gtm: "tc-01",
  technical: "ta-01",
}

test("a proposed score within the per-turn bound applies as proposed", () => {
  assert.equal(boundRiskDelta(50, 58), 58)
  assert.equal(boundRiskDelta(50, 43), 43)
  assert.equal(boundRiskDelta(50, 50), 50)
})

test("a proposed score beyond the bound moves at most maxDelta from current", () => {
  assert.equal(boundRiskDelta(50, 95), 60)
  assert.equal(boundRiskDelta(50, 5), 40)
  assert.equal(boundRiskDelta(50, 70, 5), 55)
})

test("bounded scores stay within 0-100 and round to whole integers", () => {
  assert.equal(boundRiskDelta(98, 130), 100)
  assert.equal(boundRiskDelta(3, -40), 0)
  assert.equal(boundRiskDelta(50, 54.4), 54)
})

test("all-zero risk yields full readiness on every axis", () => {
  const r = deriveReadiness(AXES, { market: 0, customer: 0, technical: 0, gtm: 0 })
  assert.deepEqual(r.perAxis, { market: 100, customer: 100, technical: 100, gtm: 100 })
  assert.equal(r.overall, 100)
})

test("all-max risk yields zero readiness on every axis", () => {
  const r = deriveReadiness(AXES, { market: 100, customer: 100, technical: 100, gtm: 100 })
  assert.deepEqual(r.perAxis, { market: 0, customer: 0, technical: 0, gtm: 0 })
  assert.equal(r.overall, 0)
})

test("partially scored sessions average only the scored axes", () => {
  const r = deriveReadiness(AXES, { market: 20 })
  assert.equal(r.perAxis.market, 80)
  assert.equal(r.perAxis.customer, null)
  assert.equal(r.overall, 80)
  assert.equal(r.underFire, "market")
})

test("out-of-range risk is clamped into 0-100 readiness", () => {
  const r = deriveReadiness(AXES, { market: 140, customer: -20, technical: 50, gtm: 50 })
  assert.equal(r.perAxis.market, 0)
  assert.equal(r.perAxis.customer, 100)
})

test("overall is the rounded mean of the four axes", () => {
  const r = deriveReadiness(AXES, { market: 20, customer: 40, technical: 60, gtm: 81 })
  assert.deepEqual(r.perAxis, { market: 80, customer: 60, technical: 40, gtm: 19 })
  assert.equal(r.overall, 50)
})

test("underFire is the axis with the lowest readiness", () => {
  const r = deriveReadiness(AXES, { market: 30, customer: 45, technical: 88, gtm: 51 })
  assert.equal(r.underFire, "technical")
})

test("underFire ties break toward the most recently changed axis", () => {
  const previous = { market: 70, customer: 70, technical: 60, gtm: 40 }
  const current = { market: 70, customer: 70, technical: 70, gtm: 70 }
  const r = deriveReadiness(AXES, current, previous)
  assert.equal(r.underFire, "technical")
})

test("underFire ties without history fall back to axis order", () => {
  const r = deriveReadiness(AXES, { market: 30, customer: 30, technical: 70, gtm: 70 })
  assert.equal(r.underFire, "technical")
})

test("empty scores object returns the pending value, never NaN", () => {
  const r = deriveReadiness(AXES, {})
  assert.equal(r.overall, null)
  assert.equal(r.underFire, null)
  assert.deepEqual(r.perAxis, { market: null, customer: null, technical: null, gtm: null })
})

test("undefined scores return the pending value", () => {
  const r = deriveReadiness(AXES, undefined)
  assert.equal(r.overall, null)
  assert.equal(r.underFire, null)
})

test("all axes explicitly absent return the pending value", () => {
  const r = deriveReadiness(AXES, {
    market: undefined,
    customer: undefined,
    technical: undefined,
    gtm: undefined,
  })
  assert.equal(r.overall, null)
  assert.equal(r.underFire, null)
})

test("severity thresholds sit at 50 and 70", () => {
  assert.equal(readinessSeverity(49), "bad")
  assert.equal(readinessSeverity(50), "warn")
  assert.equal(readinessSeverity(69), "warn")
  assert.equal(readinessSeverity(70), "ok")
})

test("non-finite values are filtered, not averaged into NaN", () => {
  const r = deriveReadiness(AXES, { market: NaN, customer: 40 })
  assert.equal(r.perAxis.market, null)
  assert.equal(r.perAxis.customer, 60)
  assert.equal(r.overall, 60)
  assert.equal(r.underFire, "customer")
})

test("verdict speaker: a lone panelist always delivers", () => {
  const only = [{ id: "vc-01" }]
  assert.equal(selectVerdictSpeaker(AXES, OWNERS, only, { technical: 90 }), only[0])
  assert.equal(selectVerdictSpeaker(AXES, OWNERS, [], { market: 50 }), null)
})

test("verdict speaker: multiple panelists → the weakest-axis owner delivers", () => {
  const panel = [{ id: "vc-01" }, { id: "tc-01" }, { id: "ta-01" }]
  // technical is the highest risk → lowest readiness → ta-01 owns it
  assert.equal(
    selectVerdictSpeaker(AXES, OWNERS, panel, { market: 20, customer: 30, technical: 85, gtm: 10 })?.id,
    "ta-01"
  )
  // gtm weakest → the buyer owns gtm
  assert.equal(
    selectVerdictSpeaker(AXES, OWNERS, panel, { market: 20, gtm: 70 })?.id,
    "tc-01"
  )
})

test("verdict speaker: no scores or absent owner falls back to who was faced first", () => {
  const panel = [{ id: "vc-01" }, { id: "ta-01" }]
  assert.equal(selectVerdictSpeaker(AXES, OWNERS, panel, undefined)?.id, "vc-01")
  // customer axis weakest but tc-01 not on the panel
  assert.equal(selectVerdictSpeaker(AXES, OWNERS, panel, { customer: 90, market: 10 })?.id, "vc-01")
})
