// Shared transcript-ordering logic, imported by both Convex functions and
// room components. Entries are stored in arrival order; speech order is
// derived at read time from spokenAt (measured speech onset), falling back
// to the write-time timestamp for legacy rows that predate spokenAt.

export type SpokenOrderable = {
  timestamp: number
  spokenAt?: number
}

export const spokenTime = (entry: SpokenOrderable) =>
  entry.spokenAt ?? entry.timestamp

export const bySpokenTime = <T extends SpokenOrderable>(entries: T[]): T[] =>
  [...entries].sort((a, b) => spokenTime(a) - spokenTime(b))

// The Runway engine replays the FOUNDER's turns over the data channel too
// (id `runway-transcription-user-<n>`), stamped with the avatar's `worker:`
// identity and delayed until the avatar's next turn — they are not the
// avatar's speech. Native `user:`-identity segments are filtered for the
// same reason.
export const isAvatarSpeech = (entry: {
  id: string
  participantIdentity: string
}) =>
  !entry.participantIdentity.startsWith("user:") &&
  !entry.id.startsWith("runway-transcription-user-")
