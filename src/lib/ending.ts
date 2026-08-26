// The persona's ending contract (spec: Concierge Persona). Appended to the
// session personality override by /api/avatar/connect. One string, tone
// first: every deflection routes the user toward something they are about
// to receive. Purely spoken guidance: the room's ending authority is the
// server clock, speech grace, and the idle rule — never a model signal.
const MINUTE_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
}

export const endingContract = (personaFirstName: string, roomMinutes: number): string => {
  const minutes = MINUTE_WORDS[roomMinutes] ?? String(roomMinutes)
  // Roughly two full exchanges per minute in live sessions; the floor keeps
  // the probing middle from collapsing into "a few questions then a close" —
  // the model cannot see a clock, so exchange count is its only pacing tool.
  const probeFloor = roomMinutes * 2
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
  // urgency and showed up live as a three minute close.
  const contract = ` We have the room for five minutes, so let's use every one of them.`
  const combined = `${startScript}${contract}`
  return combined.length <= 2_000 ? combined : startScript
}

// Appended to the debrief system prompt (spec: Report as Safety Net) so the
// written verdict never contradicts a close the user already heard.
export const VERDICT_RESTATE_DIRECTIVE = `
If the transcript ends with the panelist delivering a closing verdict, your spokenVerdict and verdictSummary must restate that same close in the same spirit. Do not compose a rival verdict that contradicts what was said aloud.`
