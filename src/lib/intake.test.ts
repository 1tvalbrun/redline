import test from "node:test"
import assert from "node:assert/strict"
import { parseExtractedBrief } from "./intake.ts"

test("a full extraction maps cleanly, with option values validated", () => {
  const brief = parseExtractedBrief({
    ideaName: "Cartograph",
    description: "Turns warehouse data into a queryable map.",
    whyNow: "Warehouse adoption crossed the chasm.",
    stage: "idea",
    businessModel: "saas-tiered",
    targetUser: "midmarket-leaders",
  })
  assert.equal(brief.ideaName, "Cartograph")
  assert.equal(brief.stage, "idea")
  assert.equal(brief.businessModel, "saas-tiered")
  assert.equal(brief.targetUser, "midmarket-leaders")
})

test("missing or non-string fields become flagged gaps, never guesses", () => {
  const brief = parseExtractedBrief({ ideaName: 42, description: null })
  assert.deepEqual(brief, {
    ideaName: null,
    description: null,
    whyNow: null,
    stage: null,
    businessModel: null,
    targetUser: null,
  })
})

test("values outside the option vocabulary are rejected, not stored", () => {
  const brief = parseExtractedBrief({
    stage: "series-b",
    businessModel: "crypto",
    targetUser: "everyone",
  })
  assert.equal(brief.stage, null)
  assert.equal(brief.businessModel, null)
  assert.equal(brief.targetUser, null)
})

test("option matching is case- and whitespace-insensitive", () => {
  const brief = parseExtractedBrief({ stage: " Idea ", targetUser: "MIDMARKET-LEADERS" })
  assert.equal(brief.stage, "idea")
  assert.equal(brief.targetUser, "midmarket-leaders")
})

test("whitespace-only free text is a gap; overlong text is truncated", () => {
  const brief = parseExtractedBrief({
    whyNow: "   ",
    description: "x".repeat(700),
  })
  assert.equal(brief.whyNow, null)
  assert.ok(brief.description!.length <= 600)
  assert.ok(brief.description!.endsWith("…"))
})

test("garbage input yields an all-gaps extraction", () => {
  assert.deepEqual(parseExtractedBrief("not an object").ideaName, null)
  assert.deepEqual(parseExtractedBrief(undefined).stage, null)
})
