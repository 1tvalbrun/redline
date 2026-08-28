import test from "node:test"
import assert from "node:assert/strict"
import { closeCheckWindow, endingContract, withTimeContract } from "./ending.ts"

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
    "at least 20 full exchanges",
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
  // "Up to", not a promise of the full five: the model closes when it
  // closes, and the spoken contract must survive an early landing.
  assert.ok(withTimeContract("Welcome.").includes("up to five minutes"))
  assert.ok(withTimeContract("Welcome.").length <= 2_000)
})

test("the close check sees the validated window shape: last eight turns, USER/PANELIST labels", () => {
  // The 39/39 offline validation ran against exactly this rendering; a
  // silent change to labels or window size changes what the detector sees.
  const turns = Array.from({ length: 10 }, (_, i) => ({
    type: (i % 2 === 0 ? "panelist" : "user") as "panelist" | "user",
    text: `turn ${i}`,
  }))
  const lines = closeCheckWindow(turns).split("\n")
  assert.equal(lines.length, 8)
  assert.equal(lines[0], "PANELIST: turn 2")
  assert.equal(lines[7], "USER: turn 9")
})
