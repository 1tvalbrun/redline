import test from "node:test"
import assert from "node:assert/strict"
import { endingContract, withTimeContract } from "./ending.ts"

test("contract carries the load-bearing directives", () => {
  const contract = endingContract("Marcus", 5)
  for (const marker of [
    "final question",
    "20 seconds",
    "never introduce a new",
    "debrief",
    "confirm once",
    // The early-close guards: the probing floor and the no-close-on-a-thin-
    // thread rule are what keep the model from spending a five minute room
    // in three (observed live before this contract revision).
    "at least 10 full exchanges",
    "never begin your close just because a thread has thinned",
  ]) {
    assert.ok(contract.toLowerCase().includes(marker.toLowerCase()), `missing: ${marker}`)
  }
})

test("startScript contract stays inside Runway's 2000-char limit", () => {
  // A base long enough that appending the contract would cross the cap:
  // the guard must return the base unchanged, never a truncated hybrid.
  const nearCap = "x".repeat(1_990)
  assert.equal(withTimeContract(nearCap), nearCap)
  assert.ok(withTimeContract("Welcome.").includes("five minutes"))
  assert.ok(withTimeContract("Welcome.").length <= 2_000)
})
