import test from "node:test"
import assert from "node:assert/strict"
import { CONTROL_AREAS, areaByLabel, DEFAULT_AREA } from "./catalog.ts"

// Integrity checks on the authored catalog. The source-of-truth comparison
// (against the CIS documents) happens at authoring time and SME review;
// these hold the internal invariants the prompts and briefing rely on.

test("safeguard ids are unique and belong to their area's control", () => {
  const seen = new Set<string>()
  for (const area of CONTROL_AREAS) {
    for (const safeguard of area.safeguards) {
      assert.ok(!seen.has(safeguard.id), `duplicate id ${safeguard.id}`)
      seen.add(safeguard.id)
      assert.equal(
        safeguard.id.split(".")[0],
        String(area.control),
        `${safeguard.id} filed under Control ${area.control}`
      )
    }
  }
})

test("every safeguard carries a restatement, evidence, and a probe", () => {
  for (const area of CONTROL_AREAS) {
    for (const safeguard of area.safeguards) {
      assert.ok(safeguard.restatement.length > 40, `${safeguard.id} restatement too thin`)
      assert.ok(safeguard.evidence.length > 0, `${safeguard.id} has no evidence list`)
      assert.ok(safeguard.probe.length > 20, `${safeguard.id} probe too thin`)
    }
  }
})

test("area labels resolve and the fallback is Data Recovery", () => {
  for (const area of CONTROL_AREAS) {
    assert.equal(areaByLabel(area.label), area)
  }
  assert.equal(areaByLabel("nonsense"), undefined)
  assert.equal(DEFAULT_AREA.control, 11)
})

test("session areas stay session-sized", () => {
  for (const area of CONTROL_AREAS) {
    assert.ok(
      area.safeguards.length >= 3 && area.safeguards.length <= 6,
      `${area.label}: ${area.safeguards.length} safeguards`
    )
  }
})
