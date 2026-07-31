import test from "node:test"
import assert from "node:assert/strict"
import { isSessionStale, lastActivityAt, STALE_SESSION_MS } from "./session.ts"

test("a session at exactly the threshold is not yet stale", () => {
  assert.equal(isSessionStale(3, 1000, 1000 + STALE_SESSION_MS), false)
  assert.equal(isSessionStale(3, 1000, 1000 + STALE_SESSION_MS + 1), true)
})

test("a silent room never goes stale, however old", () => {
  assert.equal(isSessionStale(0, 1000, 1000 + STALE_SESSION_MS * 100), false)
})

test("activity is the last transcript entry, or creation for a silent room", () => {
  const t0 = 5000
  assert.equal(lastActivityAt([], t0), t0)
  assert.equal(
    lastActivityAt([{ timestamp: 6000 }, { timestamp: 9000 }], t0),
    9000
  )
})
