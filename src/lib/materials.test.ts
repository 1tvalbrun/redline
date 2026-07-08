import test from "node:test"
import assert from "node:assert/strict"
import {
  MAX_MATERIAL_BYTES,
  clampExtractedText,
  materialFileType,
  ooxmlText,
  validateMaterialFile,
} from "./materials.ts"

test("file type derives from the extension, case-insensitively", () => {
  assert.equal(materialFileType("Deck.PDF"), "pdf")
  assert.equal(materialFileType("model.v2.xlsx"), "xlsx")
  assert.equal(materialFileType("notes.txt"), null)
  assert.equal(materialFileType("no-extension"), null)
})

test("validation rejects unsupported, empty, and oversized files", () => {
  assert.equal(validateMaterialFile("deck.key", 1000), "unsupported")
  assert.equal(validateMaterialFile("deck.pdf", 0), "empty")
  assert.equal(validateMaterialFile("deck.pdf", MAX_MATERIAL_BYTES + 1), "oversized")
  assert.equal(validateMaterialFile("deck.pdf", MAX_MATERIAL_BYTES), null)
})

test("ooxmlText pulls text runs and decodes entities", () => {
  const docx = `<w:p><w:t>Cartograph deck</w:t><w:t xml:space="preserve"> &amp; model</w:t></w:p>`
  assert.equal(ooxmlText(docx, "w:t"), "Cartograph deck & model")
})

test("ooxmlText ignores other tags and whitespace-only runs", () => {
  const pptx = `<a:p><a:t>Revenue</a:t><a:t> </a:t><a:br/><a:t>$2M ARR</a:t></a:p><w:t>wrong tag</w:t>`
  assert.equal(ooxmlText(pptx, "a:t"), "Revenue $2M ARR")
})

test("extracted text is clamped with a truncation marker", () => {
  const long = "x".repeat(100_000)
  const clamped = clampExtractedText(long)
  assert.ok(clamped.length < long.length)
  assert.ok(clamped.endsWith("[truncated]"))
  assert.equal(clampExtractedText("short"), "short")
})
