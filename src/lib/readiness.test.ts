import test from "node:test"
import assert from "node:assert/strict"
import { deriveReadiness, readinessSeverity } from "./readiness.ts"

test("all-zero risk yields full readiness on every axis", () => {
  const r = deriveReadiness({ market: 0, customer: 0, technical: 0, gtm: 0 })
  assert.deepEqual(r.perAxis, { market: 100, customer: 100, technical: 100, gtm: 100 })
  assert.equal(r.overall, 100)
})

test("all-max risk yields zero readiness on every axis", () => {
  const r = deriveReadiness({ market: 100, customer: 100, technical: 100, gtm: 100 })
  assert.deepEqual(r.perAxis, { market: 0, customer: 0, technical: 0, gtm: 0 })
  assert.equal(r.overall, 0)
})

test("partially scored sessions average only the scored axes", () => {
  const r = deriveReadiness({ market: 20 })
  assert.equal(r.perAxis.market, 80)
  assert.equal(r.perAxis.customer, null)
  assert.equal(r.overall, 80)
  assert.equal(r.underFire, "market")
})

test("out-of-range risk is clamped into 0-100 readiness", () => {
  const r = deriveReadiness({ market: 140, customer: -20, technical: 50, gtm: 50 })
  assert.equal(r.perAxis.market, 0)
  assert.equal(r.perAxis.customer, 100)
})

test("overall is the rounded mean of the four axes", () => {
  const r = deriveReadiness({ market: 20, customer: 40, technical: 60, gtm: 81 })
  assert.deepEqual(r.perAxis, { market: 80, customer: 60, technical: 40, gtm: 19 })
  assert.equal(r.overall, 50)
})

test("underFire is the axis with the lowest readiness", () => {
  const r = deriveReadiness({ market: 30, customer: 45, technical: 88, gtm: 51 })
  assert.equal(r.underFire, "technical")
})

test("underFire ties break toward the most recently changed axis", () => {
  const previous = { market: 70, customer: 70, technical: 60, gtm: 40 }
  const current = { market: 70, customer: 70, technical: 70, gtm: 70 }
  const r = deriveReadiness(current, previous)
  assert.equal(r.underFire, "technical")
})

test("underFire ties without history fall back to axis order", () => {
  const r = deriveReadiness({ market: 30, customer: 30, technical: 70, gtm: 70 })
  assert.equal(r.underFire, "technical")
})

test("empty scores object returns the pending value, never NaN", () => {
  const r = deriveReadiness({})
  assert.equal(r.overall, null)
  assert.equal(r.underFire, null)
  assert.deepEqual(r.perAxis, { market: null, customer: null, technical: null, gtm: null })
})

test("undefined scores return the pending value", () => {
  const r = deriveReadiness(undefined)
  assert.equal(r.overall, null)
  assert.equal(r.underFire, null)
})

test("all axes explicitly absent return the pending value", () => {
  const r = deriveReadiness({
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
  const r = deriveReadiness({ market: NaN, customer: 40 })
  assert.equal(r.perAxis.market, null)
  assert.equal(r.perAxis.customer, 60)
  assert.equal(r.overall, 60)
  assert.equal(r.underFire, "customer")
})
