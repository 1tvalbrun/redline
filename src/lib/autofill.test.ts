import test from "node:test"
import assert from "node:assert/strict"
import { mergeInferredScope } from "./autofill.ts"

const none: ReadonlySet<string> = new Set()

test("extracted values fill only fields that are empty and untouched", () => {
  const result = mergeInferredScope(
    { ideaName: "CourtTime", description: "" },
    new Set(["ideaName"]),
    none,
    { ideaName: "Wrong Name", description: "Booking for shared courts", targetUser: "Facility owners" }
  )
  assert.equal(result.scope.ideaName, "CourtTime")
  assert.equal(result.scope.description, "Booking for shared courts")
  assert.equal(result.scope.targetUser, "Facility owners")
  assert.deepEqual([...result.inferredKeys].sort(), ["description", "targetUser"])
})

test("a touched-but-empty field is the user's choice and stays empty", () => {
  const result = mergeInferredScope({ businessModel: "" }, new Set(["businessModel"]), none, {
    businessModel: "Tiered SaaS",
  })
  assert.equal(result.scope.businessModel, "")
  assert.equal(result.inferredKeys.size, 0)
})

test("chip arrays fill when empty and never stomp a selection", () => {
  const result = mergeInferredScope(
    { stage: [], focus: ["pricing"] },
    none,
    none,
    { stage: ["seed"], focus: ["market"] }
  )
  assert.deepEqual(result.scope.stage, ["seed"])
  assert.deepEqual(result.scope.focus, ["pricing"])
  assert.deepEqual([...result.inferredKeys], ["stage"])
})

test("empty extracted values fill nothing", () => {
  const result = mergeInferredScope({}, none, none, { ideaName: "", stage: [], description: "  " })
  assert.deepEqual(result.scope, {})
  assert.equal(result.inferredKeys.size, 0)
})

test("a second extraction keeps the first one's fills and adds its own", () => {
  const first = mergeInferredScope({}, none, none, { ideaName: "CourtTime" })
  const second = mergeInferredScope(first.scope, none, first.inferredKeys, {
    ideaName: "Other Deck Name",
    targetUser: "Gyms",
  })
  assert.equal(second.scope.ideaName, "CourtTime")
  assert.equal(second.scope.targetUser, "Gyms")
  assert.deepEqual([...second.inferredKeys].sort(), ["ideaName", "targetUser"])
})
