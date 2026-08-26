import test from "node:test"
import assert from "node:assert/strict"
import { idleState, IDLE_PROMPT_MS, IDLE_END_MS } from "./idleRule.ts"

const T0 = 1_000_000

test("active until the prompt threshold, then prompt, then end", () => {
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS - 1, false), "active")
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS, false), "prompt")
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS + IDLE_END_MS, false), "end")
})

test("suspension (mic muted or blocked) pins the state to active", () => {
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS + IDLE_END_MS, true), "active")
})
