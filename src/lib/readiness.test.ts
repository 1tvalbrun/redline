import test from "node:test"
import assert from "node:assert/strict"
import { deriveReadiness } from "./readiness.ts"

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

test("missing axes fall back to the orchestrator baseline of 50", () => {
  const r = deriveReadiness({})
  assert.deepEqual(r.perAxis, { market: 50, customer: 50, technical: 50, gtm: 50 })
  assert.equal(r.overall, 50)
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
