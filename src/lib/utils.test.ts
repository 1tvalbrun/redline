import test from "node:test"
import assert from "node:assert/strict"
import { relativeDay } from "./utils.ts"

const DAY_MS = 86_400_000

test("dates age from Today through Yesterday into short dates", () => {
  assert.equal(relativeDay(Date.now()), "Today")
  assert.equal(relativeDay(Date.now() - DAY_MS), "Yesterday")
  const threeDaysAgo = Date.now() - 3 * DAY_MS
  assert.equal(
    relativeDay(threeDaysAgo),
    new Date(threeDaysAgo).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  )
  assert.equal(relativeDay(null), "")
})

test("a date from a previous calendar year carries its year", () => {
  const lastYear = Date.now() - 400 * DAY_MS
  const rendered = relativeDay(lastYear)
  assert.ok(
    rendered.endsWith(`, ${new Date(lastYear).getFullYear()}`),
    `expected a year suffix, got: ${rendered}`
  )
})
