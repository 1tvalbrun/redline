import test from "node:test"
import assert from "node:assert/strict"
import {
  ROOM_MS,
  RESOLVE_MS,
  MIN_RECONNECT_MS,
  CLOSE_LAND_GRACE_MS,
  roomTimePhase,
  remainingMs,
  shouldInvite,
  maxDurationSec,
  shouldLandAfterClose,
  pickInvitation,
  INVITATIONS,
} from "./roomClock.ts"

const T0 = 1_000_000

test("phases move open → closing → resolving → over at the documented fractions", () => {
  assert.equal(roomTimePhase(T0, T0), "open")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS * 0.8 - 1), "open")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS * 0.8), "closing")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS - RESOLVE_MS), "resolving")
  assert.equal(roomTimePhase(T0, T0 + ROOM_MS), "over")
})

test("phases scale with a shorter room (free tier is a parameter, not a fork)", () => {
  const short = 180_000
  assert.equal(roomTimePhase(T0, T0 + short * 0.8, short), "closing")
  assert.equal(roomTimePhase(T0, T0 + short, short), "over")
})

test("remainingMs clamps at zero", () => {
  assert.equal(remainingMs(T0, T0), ROOM_MS)
  assert.equal(remainingMs(T0, T0 + ROOM_MS + 5_000), 0)
})

test("invitation window opens late in closing and closes at resolve", () => {
  assert.equal(shouldInvite(T0, T0 + ROOM_MS * 0.9), false)
  assert.equal(shouldInvite(T0, T0 + ROOM_MS * 0.93), true)
  assert.equal(shouldInvite(T0, T0 + ROOM_MS - RESOLVE_MS), false)
})

test("first connect gets the full budget; reconnect gets the remainder", () => {
  assert.equal(maxDurationSec(undefined, T0), ROOM_MS / 1000)
  assert.equal(maxDurationSec(T0, T0 + 120_000), (ROOM_MS - 120_000) / 1000)
})

test("reconnect below the floor is refused with null", () => {
  assert.equal(maxDurationSec(T0, T0 + ROOM_MS - MIN_RECONNECT_MS + 1), null)
  assert.equal(maxDurationSec(T0, T0 + ROOM_MS + 1), null)
})

test("a delivered close lands the room only after the goodbye grace, never mid-speech", () => {
  // No close on record: the clock rules alone.
  assert.equal(shouldLandAfterClose(undefined, T0, false), false)
  // Inside the grace the goodbye beat is still playing out.
  assert.equal(shouldLandAfterClose(T0, T0 + CLOSE_LAND_GRACE_MS - 1, false), false)
  // Grace passed but the persona is mid-sentence: hold.
  assert.equal(shouldLandAfterClose(T0, T0 + CLOSE_LAND_GRACE_MS, true), false)
  // Grace passed, room quiet: land.
  assert.equal(shouldLandAfterClose(T0, T0 + CLOSE_LAND_GRACE_MS, false), true)
})

test("invitations rotate by seed, name the persona, and contain no digits or em dashes", () => {
  const picks = new Set(
    Array.from({ length: INVITATIONS.length }, (_, i) => pickInvitation(i, "Marcus"))
  )
  assert.equal(picks.size, INVITATIONS.length)
  for (const line of picks) {
    assert.doesNotMatch(line, /[0-9—]/)
    // Substitution must run to completion: a literal placeholder in spoken
    // copy is the realistic regression here.
    assert.doesNotMatch(line, /\{name\}/)
  }
  const named = INVITATIONS.filter((line) => line.includes("{name}")).length
  const substituted = [...picks].filter((line) => line.includes("Marcus")).length
  assert.equal(substituted, named)
})
