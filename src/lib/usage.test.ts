import test from "node:test"
import assert from "node:assert/strict"
import {
  openAiCostUsd,
  runwayCostUsd,
  RUNWAY_CONNECT_USD,
  ASSEMBLYAI_PER_MINUTE_USD,
  emptyTotals,
  addEvent,
  addSession,
  finalizeTotals,
} from "./usage.ts"
import { STALE_SESSION_MS } from "./session.ts"

test("openai cost prices known models per million tokens", () => {
  // gpt-5-nano: $0.05/M input, $0.40/M output
  assert.equal(openAiCostUsd("gpt-5-nano", 1_000_000, 1_000_000), 0.45)
  // gpt-5-mini: $0.25/M input, $2.00/M output
  assert.equal(openAiCostUsd("gpt-5-mini", 1_000_000, 500_000), 1.25)
})

test("openai cost on a realistic orchestrator call is a fraction of a cent", () => {
  const cost = openAiCostUsd("gpt-5-nano", 900, 60)
  assert.ok(cost > 0)
  assert.ok(cost < 0.001)
})

test("openai cost for an unknown model records zero rather than guessing", () => {
  assert.equal(openAiCostUsd("some-future-model", 10_000, 10_000), 0)
})

test("openai cost with zero tokens is zero", () => {
  assert.equal(openAiCostUsd("gpt-5-nano", 0, 0), 0)
})

test("runway cost matches the verified maxed-out session: $1.02 for one connect, 5 minutes", () => {
  assert.equal(runwayCostUsd(1, 5), 1.02)
})

test("runway cost counts each connect's start fee", () => {
  assert.equal(runwayCostUsd(3, 0), 3 * RUNWAY_CONNECT_USD)
})

test("assemblyai streaming rate is $0.15/hour expressed per minute", () => {
  assert.equal(ASSEMBLYAI_PER_MINUTE_USD * 60, 0.15)
})

test("an avatar connect folds into the connect count, not the openai tallies", () => {
  const totals = emptyTotals()
  addEvent(totals, { kind: "avatar_connect", costUsd: RUNWAY_CONNECT_USD })
  assert.equal(totals.avatarConnects, 1)
  assert.equal(totals.openAiCalls, 0)
  assert.equal(totals.openAiUsd, 0)
})

test("an openai event folds calls, tokens, and cost", () => {
  const totals = emptyTotals()
  addEvent(totals, { kind: "debrief", inputTokens: 4000, outputTokens: 900, costUsd: 0.0028 })
  addEvent(totals, { kind: "orchestrate", inputTokens: 900, outputTokens: 60, costUsd: 0.0001 })
  assert.equal(totals.openAiCalls, 2)
  assert.equal(totals.inputTokens, 4900)
  assert.equal(totals.outputTokens, 960)
  assert.equal(totals.openAiUsd, 0.0029)
})

test("a concluded session is charged from creation to endedAt", () => {
  const totals = emptyTotals()
  addSession(totals, { createdAt: 0, endedAt: 120_000, lastActivityAt: 0, now: 500_000 })
  assert.equal(totals.sessionCount, 1)
  assert.equal(totals.sessionMinutes, 2)
})

test("a live session is charged up to now", () => {
  const totals = emptyTotals()
  addSession(totals, { createdAt: 0, lastActivityAt: 60_000, now: 120_000 })
  assert.equal(totals.sessionMinutes, 2)
})

test("an abandoned live session is capped at last activity plus the stale window", () => {
  const totals = emptyTotals()
  addSession(totals, { createdAt: 0, lastActivityAt: 60_000, now: 10 * STALE_SESSION_MS })
  assert.equal(totals.sessionMinutes, (60_000 + STALE_SESSION_MS) / 60_000)
})

test("finalize prices avatar minutes, stt, and the total on top of the fold", () => {
  const totals = emptyTotals()
  addEvent(totals, { kind: "avatar_connect", costUsd: RUNWAY_CONNECT_USD })
  addEvent(totals, { kind: "audit", inputTokens: 1000, outputTokens: 100, costUsd: 0.01 })
  addSession(totals, { createdAt: 0, endedAt: 300_000, lastActivityAt: 0, now: 300_000 })
  const row = finalizeTotals(totals)
  assert.equal(row.estRunwayUsd, runwayCostUsd(1, 5))
  assert.equal(row.estSttUsd, 5 * ASSEMBLYAI_PER_MINUTE_USD)
  assert.ok(Math.abs(row.totalUsd - (0.01 + 1.02 + 0.0125)) < 1e-9)
})
