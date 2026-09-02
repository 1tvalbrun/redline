// All landing math in one place. Times derive from absolute timestamps so
// background-tab timer throttling can't skew the landing (spec: Room Clock).
// roomStartedAt is stamped when Runway reports the avatar READY — AFTER
// Runway's session create, so Runway's own maxDuration window leads our
// clock by however long the READY poll took. CONNECT_GRACE_SEC is the
// margin that keeps Runway from cutting the avatar before our clock lands
// the room.
export const ROOM_MS = 300_000
export const RESOLVE_MS = 10_000
export const MIN_RECONNECT_MS = 30_000
// Runway's window opens at create; ours at READY. The connect route polls
// READY for up to 60s, so the sessions we ask Runway for run this much
// longer than the briefed room budget — the room's own clock still lands
// on time, the slack only exists so Runway never hangs up first.
export const CONNECT_GRACE_SEC = 90
// The goodbye beat after a detected close. Detection itself runs a turn
// late (an avatar final commits only when her next turn starts), so by the
// time this grace starts the user has heard the close and the persona's
// warm sign-off is already underway.
export const CLOSE_LAND_GRACE_MS = 12_000

const CLOSING_FRACTION = 0.8
const INVITE_FRACTION = 0.93

export type RoomTimePhase = "open" | "closing" | "resolving" | "over"

export const remainingMs = (roomStartedAt: number, now: number, roomMs = ROOM_MS): number =>
  Math.max(0, roomStartedAt + roomMs - now)

export const roomTimePhase = (
  roomStartedAt: number,
  now: number,
  roomMs = ROOM_MS
): RoomTimePhase => {
  const elapsed = now - roomStartedAt
  if (elapsed >= roomMs) return "over"
  if (elapsed >= roomMs - RESOLVE_MS) return "resolving"
  if (elapsed >= roomMs * CLOSING_FRACTION) return "closing"
  return "open"
}

export const shouldInvite = (roomStartedAt: number, now: number, roomMs = ROOM_MS): boolean => {
  const elapsed = now - roomStartedAt
  return elapsed >= roomMs * INVITE_FRACTION && elapsed < roomMs - RESOLVE_MS
}

// Once the panelist has delivered the closing read (closeDeliveredAt is
// stamped server-side by orchestrator.decide), the room lands after the
// goodbye grace — dead air past a close is thrown-away paid time, observed
// live as a minute of silence into the clock. Never mid-speech.
export const shouldLandAfterClose = (
  closeDeliveredAt: number | undefined,
  now: number,
  avatarSpeaking: boolean
): boolean =>
  closeDeliveredAt !== undefined &&
  !avatarSpeaking &&
  now - closeDeliveredAt >= CLOSE_LAND_GRACE_MS

// undefined roomStartedAt = first connect (full budget). Below the floor,
// null: the room is effectively over — go to the debrief, don't mint.
export const maxDurationSec = (
  roomStartedAt: number | undefined,
  now: number,
  roomMs = ROOM_MS
): number | null => {
  if (roomStartedAt === undefined) return Math.ceil(roomMs / 1000)
  const remaining = remainingMs(roomStartedAt, now, roomMs)
  if (remaining < MIN_RECONNECT_MS) return null
  return Math.ceil(remaining / 1000)
}

// Shown only while the user still holds the floor in the final stretch.
// Product rule: soft invitations, varied per session, no digits, no em dashes.
export const INVITATIONS = [
  "Finish your thought. {name} has their read ready.",
  "Take your closing thought.",
  "A few final moments. Bring it home.",
  "Time to bring it home. {name} goes next.",
  "Wrap up when you're ready. {name} has thoughts for you.",
]

export const pickInvitation = (seed: number, personaFirstName: string): string =>
  INVITATIONS[Math.abs(Math.trunc(seed)) % INVITATIONS.length].replaceAll(
    "{name}",
    personaFirstName
  )
