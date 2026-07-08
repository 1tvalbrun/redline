import test from "node:test"
import assert from "node:assert/strict"
import { deriveAuditRiskScores } from "./preRunScores.ts"
import type { Claim, Gap } from "./audit.ts"

const claim = (axis: Claim["axis"]): Claim => ({
  text: "cited claim",
  citation: { source: "deck.pdf", location: "page 1" },
  axis,
})

const gap = (axis: Gap["axis"], severity: Gap["severity"] = "gap"): Gap => ({
  severity,
  kind: "absent",
  title: "gap",
  detail: "",
  axis,
})

test("an axis with no signals stays at the 50 baseline", () => {
  const scores = deriveAuditRiskScores({ claims: [], gaps: [] })
  assert.deepEqual(scores, { market: 50, customer: 50, technical: 50, gtm: 50 })
})

test("cited claims relieve risk on their axis only", () => {
  const scores = deriveAuditRiskScores({ claims: [claim("market"), claim("market")], gaps: [] })
  assert.equal(scores.market, 38)
  assert.equal(scores.technical, 50)
})

test("blockers weigh more than plain gaps", () => {
  const withBlocker = deriveAuditRiskScores({ claims: [], gaps: [gap("technical", "blocker")] })
  const withGap = deriveAuditRiskScores({ claims: [], gaps: [gap("technical", "gap")] })
  assert.equal(withBlocker.technical, 65)
  assert.equal(withGap.technical, 58)
  assert.ok(withBlocker.technical > withGap.technical)
})

test("thin input (no claims, many gaps) drives risk up but never past 95", () => {
  const gaps = Array.from({ length: 10 }, () => gap("customer", "blocker"))
  const scores = deriveAuditRiskScores({ claims: [], gaps })
  assert.equal(scores.customer, 95)
})

test("heavy evidence never drops risk below 5", () => {
  const claims = Array.from({ length: 15 }, () => claim("gtm"))
  const scores = deriveAuditRiskScores({ claims, gaps: [] })
  assert.equal(scores.gtm, 5)
})

test("entries without an axis tag carry no signal", () => {
  const scores = deriveAuditRiskScores({
    claims: [claim(undefined)],
    gaps: [gap(undefined, "blocker")],
  })
  assert.deepEqual(scores, { market: 50, customer: 50, technical: 50, gtm: 50 })
})
