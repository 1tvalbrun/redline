import test from "node:test"
import assert from "node:assert/strict"
import { modelSettings, resolveModel } from "./openai.ts"

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

test("fast tier requests minimal reasoning on reasoning models", () => {
  assert.deepEqual(modelSettings("fast", { OPENAI_MODEL_FAST: "gpt-5-nano" }), {
    model: "gpt-5-nano",
    reasoning_effort: "minimal",
  })
})

test("quality tier requests low reasoning on reasoning models", () => {
  assert.deepEqual(modelSettings("quality", { OPENAI_MODEL_QUALITY: "gpt-5-mini" }), {
    model: "gpt-5-mini",
    reasoning_effort: "low",
  })
})

test("o-series models also take a reasoning effort", () => {
  assert.deepEqual(modelSettings("fast", { OPENAI_MODEL_FAST: "o4-mini" }), {
    model: "o4-mini",
    reasoning_effort: "minimal",
  })
})

test("non-reasoning models get no reasoning_effort parameter", () => {
  assert.deepEqual(modelSettings("fast", {}), { model: "gpt-4o-mini" })
  assert.deepEqual(modelSettings("quality", { OPENAI_MODEL_QUALITY: "gpt-4o" }), {
    model: "gpt-4o",
  })
})
