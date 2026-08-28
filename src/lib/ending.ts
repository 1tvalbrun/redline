// The persona's ending contract (spec: Concierge Persona). Appended to the
// session personality override by /api/avatar/connect. One string, tone
// first: every deflection routes the user toward something they are about
// to receive. Purely spoken guidance: the room's ending authority is the
// server clock, speech grace, the idle rule — and the detected close,
// which the orchestrator stamps server-side (closeDeliveredAt) so a
// delivered verdict lands the room instead of stranding it.
const MINUTE_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
}

export const endingContract = (personaFirstName: string, roomMinutes: number): string => {
  const minutes = MINUTE_WORDS[roomMinutes] ?? String(roomMinutes)
  // Measured live pace is 13-17s per exchange (~4/minute), and the model
  // under-runs whatever floor it is given (observed: closed at 5 of a
  // mandated 10). The floor is best-effort pressure to keep probing, not a
  // timing mechanism — the room's ending is owned by the clock and by
  // close-detection landing (closeDeliveredAt), which make an early close
  // end the room instead of stranding it.
  const probeFloor = roomMinutes * 4
  return `

TIME AND ENDING (strict):
Your session runs exactly ${minutes} minutes and ends automatically, with a short grace to finish a sentence. You cannot see a clock, so pace by exchanges: an opening, then a probing middle of at least ${probeFloor} full exchanges, then announce your final question, then deliver your closing read. After announcing your final question, ask exactly one question and no follow-ups.
This room is their paid practice, and every minute you leave unused is thrown away: never begin your close just because a thread has thinned. When a thread runs out, open your next probe instead: press an earlier answer harder, test a claim they got away with, or take the weakest part of their story one level deeper. Begin your close only once the probing middle has run its full count, or they clearly signal they are done.
Your closing read is the climax, not an afterthought. Keep the close under 20 seconds of speech: first acknowledge specifically what they defended well, then name what did not hold without piling on, and end forward-looking with what you would want to see next time. Never introduce a new attack in the close. The session ends itself; your job is to fill the room, then land it.
If they seem rattled or flustered, lead the close with what held and keep the harder truths for their written debrief.
If they raise a big new question late, do not ignore it and do not attempt it: tell them it deserves a real answer and it is going in their debrief.
If they ask for more time, the format is fixed: tell them to hold that thought for next session and that you will remember it.
If they signal they are done (for example "I think that's everything" or "bye"), confirm once that they are ready for your read, then close.
After your close, never reopen the discussion. Respond warmly and briefly, and point to the debrief, ${personaFirstName} style.`
}

// Spoken verbatim at the top of the session: the time contract makes the
// later wind-down a promise kept instead of a surprise. Shrunk to one clause
// (smoke-test revision: the full paragraph cost ~10s of session time) — the
// explicit terms now live on the connecting screen instead, where time is
// free. Runway caps startScript at 2000 chars; the base script wins if space
// is short.
export const withTimeContract = (startScript: string): string => {
  // Promises the time limit without priming a rush: "on the clock" read as
  // urgency and showed up live as a three minute close. "Up to", not a flat
  // five, and "make them count", not "use every one" — the room lands when
  // the close is delivered, so nothing spoken may promise the full five.
  const contract = ` We have the room for up to five minutes, so let's make them count.`
  const combined = `${startScript}${contract}`
  return combined.length <= 2_000 ? combined : startScript
}

// Appended to the debrief system prompt (spec: Report as Safety Net) so the
// written verdict never contradicts a close the user already heard.
export const VERDICT_RESTATE_DIRECTIVE = `
If the transcript ends with the panelist delivering a closing verdict, your spokenVerdict and verdictSummary must restate that same close in the same spirit. Do not compose a rival verdict that contradicts what was said aloud.`

// The close check runs as its own model call (orchestrator.decide), never
// as a rider on the note-taking prompt: piggybacked, detection failed on
// the recorded sessions once post-close chatter filled the window; as a
// single-task question it went 39/39 across every window of both. The
// ended/not-ended definition covers deflections on purpose — every
// post-close turn is then a fresh detection chance, so a check debounced
// away at the close itself still catches on the next turn.
export const CLOSE_CHECK_PROMPT = `You are watching a live practice session between a USER and a PANELIST who interviews them. Decide one thing: has the panelist ENDED the session?

Ended (true): the panelist has delivered a wrap-up or final read on how the user did, said goodbye or "see you next time", or is now declining new questions by pointing to a future session or the written debrief.
Not ended (false): the panelist is still working — asking questions, probing answers, reacting to what the user says — or has only announced that a final question is coming without wrapping up afterward.

Answer with JSON only: {"sessionEnded": true|false}`

// The exact window shape the prompt was validated against: last eight
// turns, USER/PANELIST labels — persona- and pack-agnostic.
export const closeCheckWindow = (
  turns: { type: "user" | "panelist"; text: string }[]
): string =>
  turns
    .slice(-8)
    .map((turn) => (turn.type === "user" ? `USER: ${turn.text}` : `PANELIST: ${turn.text}`))
    .join("\n")
