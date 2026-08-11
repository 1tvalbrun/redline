import test from "node:test"
import assert from "node:assert/strict"
import { firstNameOf } from "./types.ts"

// Pins the honorific rule: "Practice with Dr." shipped once.
test("firstNameOf skips honorifics", () => {
  assert.equal(firstNameOf("Dr. Sarah Okafor"), "Sarah")
  assert.equal(firstNameOf("Cole Merritt"), "Cole")
  assert.equal(firstNameOf("Victoria Chen"), "Victoria")
})

test("firstNameOf falls back to the full name when every word is an honorific", () => {
  assert.equal(firstNameOf("Dr."), "Dr.")
})
