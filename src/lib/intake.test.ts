import test from "node:test"
import assert from "node:assert/strict"
import { parseExtractedScope } from "./intake.ts"
import type { ScopeField } from "../domains/types.ts"

const FIELDS: ScopeField[] = [
  { key: "offering", label: "What you're selling", kind: "text", required: true, maxLength: 60 },
  { key: "description", label: "What it does", kind: "textarea", required: true, maxLength: 600 },
  {
    key: "ask",
    label: "The ask",
    kind: "chips",
    options: [
      { value: "pilot", label: "A pilot" },
      { value: "contract", label: "A signed contract" },
    ],
  },
  {
    key: "objections",
    label: "Objections",
    kind: "multi",
    options: [
      { value: "price", label: "Price" },
      { value: "timing", label: "Timing" },
    ],
  },
]

test("spoken content maps onto scope fields", () => {
  const scope = parseExtractedScope(
    {
      offering: "  CourtTime scheduling ",
      description: "Court booking that removes double-booked slots",
      ask: "A pilot",
      objections: ["Price", "Timing"],
    },
    FIELDS
  )
  assert.deepEqual(scope, {
    offering: "CourtTime scheduling",
    description: "Court booking that removes double-booked slots",
    ask: "A pilot",
    objections: ["Price", "Timing"],
  })
})

test("what wasn't said stays absent, never guessed", () => {
  const scope = parseExtractedScope({ offering: "CourtTime", ask: null }, FIELDS)
  assert.deepEqual(scope, { offering: "CourtTime" })
})

test("chip values outside the vocabulary are dropped", () => {
  const scope = parseExtractedScope(
    { ask: "a quick sale", objections: ["Price", "Vendor fatigue"] },
    FIELDS
  )
  assert.deepEqual(scope, { objections: ["Price"] })
})

test("free text is clamped to the field limit", () => {
  const scope = parseExtractedScope({ offering: "x".repeat(200) }, FIELDS)
  assert.equal((scope.offering as string).length, 60)
})

test("garbage input yields an empty scope", () => {
  assert.deepEqual(parseExtractedScope(null, FIELDS), {})
  assert.deepEqual(parseExtractedScope({ offering: 42, objections: "Price" }, FIELDS), {})
})
