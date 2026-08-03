import test from "node:test"
import assert from "node:assert/strict"
import { resolveModel } from "./openai.ts"

test("fast tier prefers OPENAI_MODEL_FAST, else the default", () => {
  assert.equal(resolveModel("fast", { OPENAI_MODEL_FAST: "fast-model" }), "fast-model")
  assert.equal(resolveModel("fast", {}), "gpt-4o-mini")
})

test("quality tier falls through quality → fast → default", () => {
  assert.equal(
    resolveModel("quality", { OPENAI_MODEL_QUALITY: "quality-model", OPENAI_MODEL_FAST: "fast-model" }),
    "quality-model"
  )
  assert.equal(resolveModel("quality", { OPENAI_MODEL_FAST: "fast-model" }), "fast-model")
  assert.equal(resolveModel("quality", {}), "gpt-4o-mini")
})

test("quality never falls back to fast when quality is set", () => {
  assert.equal(resolveModel("quality", { OPENAI_MODEL_QUALITY: "quality-model" }), "quality-model")
})
