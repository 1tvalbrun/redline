import test from "node:test"
import assert from "node:assert/strict"
import { bySpokenTime, spokenTime } from "./transcript.ts"

test("sorts by measured speech time, not arrival order", () => {
  const greeting = { timestamp: 2000, spokenAt: 100, text: "greeting" }
  const reply = { timestamp: 1000, spokenAt: 700, text: "reply" }
  assert.deepEqual(
    bySpokenTime([reply, greeting]).map((e) => e.text),
    ["greeting", "reply"]
  )
})

test("legacy rows without spokenAt fall back to write time and interleave", () => {
  const legacy = { timestamp: 500, text: "legacy" }
  const measured = { timestamp: 2000, spokenAt: 900, text: "measured" }
  assert.equal(spokenTime(legacy), 500)
  assert.deepEqual(
    bySpokenTime([measured, legacy]).map((e) => e.text),
    ["legacy", "measured"]
  )
})

test("does not mutate the input array", () => {
  const entries = [
    { timestamp: 2, text: "b" },
    { timestamp: 1, text: "a" },
  ]
  bySpokenTime(entries)
  assert.deepEqual(entries.map((e) => e.text), ["b", "a"])
})
