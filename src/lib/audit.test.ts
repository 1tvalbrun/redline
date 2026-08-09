import test from "node:test"
import assert from "node:assert/strict"
import { groundAudit, locationsIn } from "./audit.ts"

const MATERIALS = [
  { name: "deck.pdf", text: "[page 1] intro [page 2] $2M ARR run-rate [page 3] team" },
  { name: "one_pager.docx", text: "Cartograph one-pager: tiered SaaS." },
]

test("locations parse page, slide, and sheet markers", () => {
  const locations = locationsIn("[page 1] a [slide 12] b [sheet ARR Model] c")
  assert.deepEqual([...locations], ["page 1", "slide 12", "sheet arr model"])
})

test("a material without markers is citable as one document", () => {
  assert.deepEqual([...locationsIn("plain text, no markers")], ["document"])
})

test("a claim citing a real source and location survives with its citation", () => {
  const result = groundAudit(
    { claims: [{ text: "$2M ARR run-rate", source: "deck.pdf", location: "page 2" }], gaps: [] },
    MATERIALS
  )
  assert.deepEqual(result.claims, [
    { text: "$2M ARR run-rate", citation: { source: "deck.pdf", location: "page 2" } },
  ])
  assert.equal(result.gaps.length, 0)
})

test("citations are matched case-insensitively", () => {
  const result = groundAudit(
    { claims: [{ text: "Tiered SaaS", source: "One_Pager.DOCX", location: "Document" }] },
    MATERIALS
  )
  assert.equal(result.claims.length, 1)
})

test("a claim with no locatable source is demoted to an unsupported gap", () => {
  const result = groundAudit(
    {
      claims: [
        { text: "14 enterprise LOIs signed", source: "deck.pdf", location: "page 9" },
        { text: "99.9% uptime", source: "sla.pdf", location: "page 1" },
        { text: "Series A ready" },
      ],
    },
    MATERIALS
  )
  assert.equal(result.claims.length, 0)
  assert.equal(result.gaps.length, 3)
  for (const gap of result.gaps) {
    assert.equal(gap.kind, "unsupported")
    assert.equal(gap.severity, "gap")
  }
  assert.equal(result.gaps[0].title, "14 enterprise LOIs signed")
})

test("with no materials at all, every claim is demoted — nothing can be asserted", () => {
  const result = groundAudit(
    { claims: [{ text: "Huge TAM", source: "deck.pdf", location: "page 1" }], gaps: [] },
    []
  )
  assert.equal(result.claims.length, 0)
  assert.equal(result.gaps[0].kind, "unsupported")
})

test("thin input passes through honestly: few claims, many gaps, nothing invented", () => {
  const result = groundAudit(
    {
      claims: [{ text: "Tiered SaaS", source: "one_pager.docx", location: "document" }],
      gaps: [
        { severity: "blocker", kind: "absent", title: "No revenue evidence", detail: "No model or ARR data." },
        { severity: "gap", kind: "absent", title: "No competitive landscape", detail: "" },
      ],
    },
    [MATERIALS[1]]
  )
  assert.equal(result.claims.length, 1)
  assert.equal(result.gaps.length, 2)
  assert.equal(result.gaps[0].severity, "blocker")
})

test("malformed severities and kinds coerce to safe values, junk entries drop", () => {
  const result = groundAudit(
    {
      claims: [{ text: "" }, 42, null],
      gaps: [{ severity: "catastrophic", kind: "vibes", title: "Weird gap", detail: 7 }, { title: "" }],
    },
    MATERIALS
  )
  assert.equal(result.claims.length, 0)
  assert.deepEqual(result.gaps, [
    { severity: "gap", kind: "absent", title: "Weird gap", detail: "" },
  ])
})
