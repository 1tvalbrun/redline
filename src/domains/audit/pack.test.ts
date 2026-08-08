import test from "node:test"
import assert from "node:assert/strict"
import { auditPack } from "./pack.ts"

// The ERL contract: the request list follows the chosen control area, and
// no chosen area means no list — the panel arrives at the moment of choice.

test("evidence requests follow the chosen control area", () => {
  const groups = auditPack.evidenceRequests?.({ controlArea: "Data Recovery (Control 11)" }) ?? []
  assert.equal(groups.length, 5)
  assert.match(groups[0].title, /Safeguard 11\.1/)
  for (const group of groups) {
    assert.ok(group.items.length > 0, `${group.title} has no items`)
  }
})

test("no chosen area produces no request list", () => {
  assert.deepEqual(auditPack.evidenceRequests?.({}), [])
  assert.deepEqual(auditPack.evidenceRequests?.({ controlArea: "nonsense" }), [])
})
