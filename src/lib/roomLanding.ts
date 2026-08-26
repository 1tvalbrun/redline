// One-shot handoff between the room and the report page: the room's two
// navigation paths mark the landing just before router.push, and the report
// page reads the mark during its first render (so the veil is in the first
// paint) and clears it from an effect. Peek and clear are split because a
// read-and-clear in a render-phase initializer is impure: StrictMode runs
// initializers twice, and the second run would see its own consumption.
// Direct arrivals — session list, refresh, back button — read nothing and
// get no veil. sessionStorage is per-tab, and clearing on mount means the
// veil can never replay.
const ROOM_LANDING_KEY = "prestage:room-landing"

export const markRoomLanding = () => {
  try {
    sessionStorage.setItem(ROOM_LANDING_KEY, "1")
  } catch {
    // Storage refusing (private mode, quota) must never break navigation.
  }
}

export const peekRoomLanding = (): boolean => {
  try {
    return sessionStorage.getItem(ROOM_LANDING_KEY) !== null
  } catch {
    return false
  }
}

export const clearRoomLanding = () => {
  try {
    sessionStorage.removeItem(ROOM_LANDING_KEY)
  } catch {
    // Nothing to do: peek already failed the same way and showed no veil.
  }
}
