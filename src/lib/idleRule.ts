// Live dead-air rule (spec: Care Rules). Distinct from isSessionStale in
// ./session.ts, which judges an abandoned session on re-entry; this one
// runs inside a live room. Suspended while we can't attribute the silence
// to the user (mic muted/blocked) — a muted founder must never be
// idle-ended mid-pitch.
export const IDLE_PROMPT_MS = 45_000
export const IDLE_END_MS = 20_000

export type IdleState = "active" | "prompt" | "end"

export const idleState = (lastActivityAt: number, now: number, suspended: boolean): IdleState => {
  if (suspended) return "active"
  const quiet = now - lastActivityAt
  if (quiet >= IDLE_PROMPT_MS + IDLE_END_MS) return "end"
  if (quiet >= IDLE_PROMPT_MS) return "prompt"
  return "active"
}
