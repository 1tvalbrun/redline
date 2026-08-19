// Provider rates behind the usage meter. Prices verified against the
// official pricing pages on 2026-08-18; update here when providers change
// them. Unknown OpenAI models record zero cost (tokens are still stored),
// so a model swap surfaces as a rate gap instead of a silent wrong bill.
export const OPENAI_RATES: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "gpt-5-nano": { inputPerMTok: 0.05, outputPerMTok: 0.4 },
  "gpt-5-mini": { inputPerMTok: 0.25, outputPerMTok: 2 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
}

export const openAiCostUsd = (
  model: string,
  inputTokens: number,
  outputTokens: number
): number => {
  const rate = OPENAI_RATES[model]
  if (!rate) return 0
  return (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok) / 1_000_000
}

// Runway gwm1_avatars realtime: 2 credits to start a session, 2 credits per
// 6 seconds, at $0.01/credit — $0.02 per connect plus $0.20 per minute.
export const RUNWAY_CONNECT_USD = 0.02
export const RUNWAY_PER_MINUTE_USD = 0.2

export const runwayCostUsd = (connects: number, minutes: number): number =>
  connects * RUNWAY_CONNECT_USD + minutes * RUNWAY_PER_MINUTE_USD

// AssemblyAI Universal-Streaming: $0.15/hour of streamed mic audio.
export const ASSEMBLYAI_PER_MINUTE_USD = 0.0025

// Per-user rollup accumulator, folded page by page so the summary never has
// to hold raw rows. Pure so the math is testable outside Convex.
import { STALE_SESSION_MS } from "./session.ts"

export type UsageTotals = {
  openAiCalls: number
  inputTokens: number
  outputTokens: number
  openAiUsd: number
  avatarConnects: number
  sessionCount: number
  sessionMinutes: number
}

export const emptyTotals = (): UsageTotals => ({
  openAiCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  openAiUsd: 0,
  avatarConnects: 0,
  sessionCount: 0,
  sessionMinutes: 0,
})

export const addEvent = (
  totals: UsageTotals,
  event: { kind: string; inputTokens?: number; outputTokens?: number; costUsd: number }
): void => {
  if (event.kind === "avatar_connect") {
    totals.avatarConnects += 1
    return
  }
  totals.openAiCalls += 1
  totals.inputTokens += event.inputTokens ?? 0
  totals.outputTokens += event.outputTokens ?? 0
  totals.openAiUsd += event.costUsd
}

// A session without endedAt is charged up to now, but an abandoned one stops
// accruing at last activity plus the staleness window — the same rule the
// app uses to read a session as over.
export const addSession = (
  totals: UsageTotals,
  session: { createdAt: number; endedAt?: number; lastActivityAt: number; now: number }
): void => {
  const endedAt =
    session.endedAt ?? Math.min(session.lastActivityAt + STALE_SESSION_MS, session.now)
  totals.sessionCount += 1
  totals.sessionMinutes += Math.max(0, endedAt - session.createdAt) / 60_000
}

export const finalizeTotals = (
  totals: UsageTotals
): UsageTotals & { estRunwayUsd: number; estSttUsd: number; totalUsd: number } => {
  const estRunwayUsd = runwayCostUsd(totals.avatarConnects, totals.sessionMinutes)
  const estSttUsd = totals.sessionMinutes * ASSEMBLYAI_PER_MINUTE_USD
  return { ...totals, estRunwayUsd, estSttUsd, totalUsd: totals.openAiUsd + estRunwayUsd + estSttUsd }
}
