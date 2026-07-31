// One interrogation is one sitting: a room with speech left "live" but idle
// past this threshold reads as ended everywhere (room entry, sessions
// list). A silent room never goes stale — nothing was said, so nothing
// ended, and the founder keeps their one interrogation per simulation.
// Derived at read time — no stored state to reconcile.
export const STALE_SESSION_MS = 60 * 60_000

export const lastActivityAt = (
  transcript: { timestamp: number }[],
  createdAt: number
): number => transcript[transcript.length - 1]?.timestamp ?? createdAt

export const isSessionStale = (
  turnCount: number,
  lastActivity: number,
  now: number
): boolean => turnCount > 0 && now - lastActivity > STALE_SESSION_MS
