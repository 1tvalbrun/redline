import test from "node:test"
import assert from "node:assert/strict"
import {
  blockersFirst,
  exportFilename,
  formatExportDate,
  parseOpenQuestions,
} from "./export.ts"

test("open questions split on newlines and inline question breaks", () => {
  const context =
    "When was the last access review? Who signs off on emergency access?\nHow are controls sampled?"
  assert.deepEqual(parseOpenQuestions(context), [
    "When was the last access review?",
    "Who signs off on emergency access?",
    "How are controls sampled?",
  ])
})

test("analyze prose that isn't a question is dropped", () => {
  const context = "Not provided in pitch scope.\nWhat is the churn rate?"
  assert.deepEqual(parseOpenQuestions(context), ["What is the churn rate?"])
})

test("missing context yields no questions", () => {
  assert.deepEqual(parseOpenQuestions(undefined), [])
  assert.deepEqual(parseOpenQuestions(""), [])
})

test("blockers print before gaps, order within each group preserved", () => {
  const ordered = blockersFirst([
    { severity: "gap", title: "g1" },
    { severity: "blocker", title: "b1" },
    { severity: "gap", title: "g2" },
    { severity: "blocker", title: "b2" },
  ] as const)
  assert.deepEqual(
    ordered.map((g) => g.title),
    ["b1", "b2", "g1", "g2"]
  )
})

test("filename slugs the practice name and tags the document kind", () => {
  assert.equal(exportFilename("Compliance audit", "report"), "prestage-compliance-audit-report.pdf")
  assert.equal(exportFilename("Q3 — GTM (v2)!", "debrief"), "prestage-q3-gtm-v2-debrief.pdf")
})

test("a name with nothing slugable still produces a valid filename", () => {
  assert.equal(exportFilename("???", "report"), "prestage-report.pdf")
  assert.equal(exportFilename("", "debrief"), "prestage-debrief.pdf")
})

test("export dates read as day month year", () => {
  assert.equal(formatExportDate(Date.UTC(2026, 7, 27, 12)), "27 Aug 2026")
})
