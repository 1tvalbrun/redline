# Room Ending Design — The Smooth Landing

**Date:** 2026-08-19
**Status:** Approved design, pending spikes
**Owner:** Thierry Valbrun

## Problem

Runway realtime avatar sessions hard-cap at 5 minutes. Today the room ends with
a frozen avatar and "The live session ended on {name}'s side" plus a Retry
button that, after the 5-connect cap, silently dead-ends on an unexplained
error. Mid-session failure is the AI-practice category's most reputation-costly
complaint class; a designed ending is a primary differentiator.

## Product decision

The ending is a **designed climax**, not an interruption. A session is a timed
round: the persona interrogates, sharpens, asks a final question, and delivers
a spoken closing read (the verdict beat) before time expires. Time running out
is the finale arriving. This matches the "intensity" positioning.

**The governing rule:** persona, UI, and server each independently know the
landing time. Whichever is still functional lands the plane. The model provides
the charm, the client provides the grace, the server provides the truth. No
scenario may depend on the model, the user, or the browser tab behaving.

## Non-goals

- Extending sessions past the cap (no auto-reconnect stitching; rejected as
  cost-doubling and context-losing)
- Numeric countdowns anywhere in the room
- Quota/billing policy (this design only stamps the data that policy will need)
- Switching avatar providers

## Verified platform facts (docs.dev.runwayml.com, 2026-08-19)

- `realtimeSessions.create` accepts `maxDuration` (seconds, ceiling 300). We
  choose the hard stop; the free tier's 3-minute room is one parameter.
- `backend_rpc` tools round-trip into the conversation. Handler is a persistent
  WebSocket (`@runwayml/avatars-node-rpc` joins the room via `/connect_backend`),
  one per session, timeout 1–8s per call; on timeout the character continues
  without the result (graceful degradation is built in).
- `client_event` tools are avatar→browser only, defined at session create, need
  **no** persistent handler. There is no client→avatar channel of any kind.
- Session credentials consume once; any WebRTC failure after consume requires a
  new (billed) session.
- `retrieve()` can return `NOT_READY` with `queued: true` when org concurrency
  is full.
- Personality ≤10,000 chars, startScript ≤2,000, ≤20 tools/session, tool
  descriptions ≤1,024 chars. Overrides may slow READY.
- Post-session, Runway serves transcript + tool-call history + temporary
  recordingUrl at `GET /v1/avatars/{id}/conversations/{sessionId}`.

## Spikes (gate the build; run in this order)

1. **Clock anchor.** When does Runway's `maxDuration` window actually start —
   create, READY, consume, or WebRTC connect? One instrumented real session,
   comparing timestamps against observed cutoff. Every beat time budgets
   against the earliest possible anchor until measured. Also confirms
   `maxDuration` is honored at all.
2. **RPC hosting.** Can a Convex `"use node"` action hold the
   `avatars-node-rpc` WebSocket for a session's lifetime (5 min < action
   ceiling)? If no: `time_check` moves to v2 behind a sidecar decision, and v1
   ships on the beat-structure fallback alone.
3. **Transcript tail.** How long after session end do trailing transcript
   finals arrive? Sizes the deliberation beat's pre-generation wait.

## The seven mechanisms

### 1. Room Clock (server-owned truth)

- `sessions.roomStartedAt` (optional number) stamped **once**, server-side, at
  the first successful avatar connect claim. Never updated.
- Everything derives from it: persona pacing answers, UI phases, the landing,
  and `maxDuration` on every connect. One source of truth; no client-accumulated
  timers — every phase check computes from absolute timestamps so background-tab
  throttling and device sleep cannot skew it.
- Room length: `ROOM_MS = 300_000` (a constant now; the free-tier 180_000
  variant is a parameter of the same math, not a second implementation — all
  beat times are fractions of `ROOM_MS`, not absolute seconds).
- **Reconnect carryover:** connect route passes
  `maxDuration = remaining(roomStartedAt, now)` in seconds. Below a 30s floor,
  the route refuses with a distinct "room complete" response and the client
  goes to the debrief. Kills retry-farming, keeps the round's integrity.

### 2. Concierge Persona (one personality contract)

A single ending section appended to the session personality override. Its
directives, all tone-first:

- **Contract at 0:00, split across two channels** (smoke-test revision:
  the spoken paragraph cost ~10s of session time): the explicit terms live
  on the connecting screen — "Sessions run five minutes. {Name} will call
  time near the end." — where time is free; the spoken part shrinks to one
  clause in the greeting ("We're on the clock, so let's make it count"),
  enough that the wind-down remains a promise kept.
- **Arc:** interrogate → sharpen ("two more things I want to test") → announce
  final question → closing read. In v1 the arc is beat-counted (models count
  their own questions reliably; they cannot estimate minutes). In v2,
  `time_check` (backend_rpc) grounds it in the Room Clock: the handler answers
  each call with a pacing directive derived server-side.
- **Verdict beat:** cued at 80% of room time. Hard length cap in the directive:
  under 20 seconds of speech (smoke-test revision: 30s closes started too late
  and ran into the landing). Begin the close early — "when in doubt, close
  sooner; the session ends automatically and will not wait." After announcing
  the final question, ask exactly one with no follow-ups. Structure:
  acknowledge what they defended well, name what didn't hold without piling
  on, end forward-looking. Never introduce a new attack in the close.
- **Branches:** material exhausted → close early, don't stretch. User rattled →
  lead with what held; harder truths go to the written debrief. Big question
  late → "that deserves a real answer and we're out of runway; it's going in
  your debrief." More-time request → "hold that thought for next session, I'll
  remember." User signals they're done ("I think that's everything", "bye") →
  confirm once, then close. After the close → never reopen; warmly deflect to
  the debrief.
- The farewell-intent directive **replaces** any client-side "bye" keyword
  machinery. Keyword detection against a delayed, error-prone transcript risks
  ending a session on a mishearing — the persona confirming intent
  conversationally costs one turn and zero code.

### 3. Quiet Signals (UI that only speaks when needed)

Room phase is a discriminated union derived (not stored) from
`roomStartedAt` + now:

`open → closing → finalApproach → resolving → deliberation`

- **closing** (from 80%): ambient shift only — topic chip reads "Closing",
  accent tone warms. No numbers, ever.
- **Revision (2026-08-25) — model signals removed.** The design originally
  had the persona fire an `entering_closing` client event (advance-only,
  clock authoritative). Live evidence from Runway's own conversation
  records showed every assistant turn that fired one of our client_event
  tools carried null content, after which the GWM-1 agent went permanently
  mute — the session ran on, heard every user turn, and never spoke again.
  Confirmed across four wedged sessions (one fired on turn zero, before its
  opening line) with zero null turns in healthy sessions; the model also
  fired the tools at wrong times despite hardened descriptions. The tools
  are removed entirely; phase derives from the clock alone. Revisit only if
  Runway confirms a fix for the agent wedge.
- **finalApproach** (from ~93%, only while the user holds the floor): one
  rotating invitation near the user's own tile, chosen per session:
  - "Finish your thought. {Name} has their read ready."
  - "Take your closing thought."
  - "A few final moments. Bring it home."
  - "Time to bring it home. {Name} goes next."
  - "Wrap up when you're ready. {Name} has thoughts for you."
  No digits, no imperatives about time, no em dashes. Users who pause normally
  never see it.

### 4. Guaranteed Landing (first-class, not a fallback)

- At T-10s the room lands — but with **speech grace**: if the persona is
  mid-close, the landing waits until it finishes speaking or an absolute
  floor at T-2s. We control `maxDuration`, so the floor still precedes
  Runway's cutoff. The persona's own verdict beat is never guillotined by
  our clock except at the floor.
- The landing is **chrome, not curtain** (smoke-test revision, 2026-08-20):
  no overlay, no fade, nothing covers the persona. "Recording" becomes a
  calm "Wrapping up", the pulse and elapsed clock stop, the End control
  retires; the persona stays visible and audible to its last word. The
  register is a well-run video call ending, not a game timer.
- After the wrap beat the room **settles** (revision, 2026-08-25): the
  avatar scene gives way to the room's dark ground, the chrome fades, and a
  quiet "writing up your verdict" line holds the room. Navigation waits for
  the debrief to exist — held at least 2.5s so the beat reads, capped at
  30s — and the report content rises in on arrival. The report page's own
  deliberation block remains, as the fallback for direct arrivals and slow
  generations.
- The user's mic stays hot to the last moment; nobody is silenced mid-word.
  Framing is "time being called," never "call dropped."
- This is the *expected* ending for talkative users (turn-taking means the
  persona cannot interrupt a monologue), so it receives the same design polish
  as the spoken close.
- **Revision (2026-08-25):** the `verdict_delivered` client event (report a
  completed close, end after a ~10s grace) is removed with the rest of the
  client_event tools — see mechanism 3's revision note for the confirmed
  agent wedge. All ending authority is the server clock, the speech grace
  above, and the idle rule; a model that closes early simply leaves the room
  open until the clock or the idle rule lands it, deflecting per mechanism 2.

### 5. Deliberation Beat

On any ending (time, early close, user-ended, idle), the room resolves into a
composed "reviewing your session" interstitial styled as the panelist writing
up their verdict:

- Waits the spike-3-measured tail (~2–3s) for trailing transcript finals before
  triggering debrief generation, so last words are never lost.
- Honesty budget: past ~30s the copy shifts ("taking a bit longer than
  usual"). The user can always leave; the report lands on the practice page
  when ready. Generation failure retries once, then shows a real error with
  the transcript preserved. No haunted spinners, no stranding.

### 6. Report as Safety Net

- The written verdict opens the report. The debrief prompt receives the spoken
  close from the transcript when one happened and is directed to **restate it,
  not compose a rival** — the written verdict never contradicts what was heard.
- Questions there was no time for become to-dos (feeds continuity).
- Every "you missed it live" moment ("can you repeat that?") is answered by
  the document. No path exists where the user walks away verdict-less.

### 7. Care Rules (small, silent protections)

- **Idle:** no user transcription for 45s with no persona speech in progress →
  UI asks "Still there?" → 20 more silent seconds → graceful early landing
  (client `end()` → deliberation beat). Never a hard drop.
- **Mic cross-check:** local mic signal present but no transcription arriving →
  "We can't hear you" banner; idle rule suspended. A muted-by-accident founder
  must never be idle-ended mid-pitch.
- **Connect route hardening** (ships first; fixes live money bugs):
  - `realtimeSessions.delete(id)` on the 60s poll timeout — an abandoned
    session must not hold the org's concurrency slot or bill for nobody.
  - Surface `queued: true` as its own response so the room can show
    "{Name} is finishing another session. You're next." instead of a generic
    failure.
  - Distinct client copy per refusal (already returns distinct 503/429): cap
    reached shows what happened and routes to the debrief, not a retry loop.
- **Multi-tab claim:** client generates a tab id per room mount; the connect
  claim stores it as `sessions.roomClientId`; a mismatched live tab sees "This
  session is open in another window" instead of minting competing avatar
  sessions.
- **Ending stamp:** `sessions.endedReason`
  (`"verdict" | "time" | "user" | "idle" | "error"`) written at end;
  `"verdict"` is historical only since 2026-08-25 (its writer left with the
  client_event tools; older docs still carry it). Duration
  derives from `roomStartedAt`/`endedAt` — no duplicate field. This is the data
  the future doesn't-count-short-sessions quota policy needs.

## Scenario coverage

| Scenario | Mechanisms |
|---|---|
| Talks through the ending | 3, 4, 6 |
| Finishes early / fast talker | 2 (early close) |
| Interrupts or argues with the verdict | 2, 4 |
| Big question late / asks for more time | 2, 6 |
| Rattled or upset | 2 (tone branch), 6 |
| Alt-tabbed or background tab | 1 (absolute time), 2 (voice), 6 |
| Dead mic / walked away | 7 (cross-check, idle) |
| Connection drop / laptop sleep | 1 (carryover + floor) |
| Model ignores cues / RPC dies | 4 (never model-dependent) |
| Debrief slow or fails | 5 |
| Panelist busy (org concurrency) | 7 (queued state) |
| Retry-farming / multi-tab | 1, 7 |
| Says "bye" (or mishears as such) | 2 (confirm-then-close; no keyword code) |

## Delivery phases

**Phase 0 — ship immediately, independent of the rest:** connect-route
hardening (cancel-on-timeout, queued state, distinct cap copy). Fixes live
slot/money leaks.

**Phase 1 — the landing (no RPC dependency):** Room Clock (`roomStartedAt`,
`maxDuration`, carryover + floor), beat-structure personality contract,
Quiet Signals, Guaranteed Landing, Deliberation Beat, Report as Safety Net,
idle + mic cross-check + multi-tab + `endedReason`. (The
`entering_closing` / `verdict_delivered` client events shipped here and were
removed 2026-08-25 — see mechanism 3's revision note.)

**Phase 2 — precision pacing (post spike 2):** `time_check` backend_rpc
handler answering from the Room Clock; free-tier `ROOM_MS` variant with
re-derived beat fractions (fewer probes, earlier close).

## Engineering constraints (repo standards applied)

- **Server truth, client derivation.** `roomStartedAt` is the only stored
  clock fact; phases, remaining time, and `maxDuration` are computed, never
  duplicated. No stored "phase" field anywhere.
- **Fail closed.** The connect route's remaining-time floor and every claim
  path refuse on any error; no billable mint on an unverified state.
- **No new indexes.** No new query patterns require one; `endedReason` and
  `roomStartedAt` are point-read fields on documents fetched by id.
- **Schema:** three optional fields on `sessions` — `roomStartedAt` (number),
  `endedReason` (closed union validator), `roomClientId` (string). Existing
  documents remain valid; no migration.
- **Pure logic in `src/lib`, tested (node:test):** phase derivation from
  timestamps, remaining-time and floor math, invitation selection, idle-rule
  state machine. Convex plumbing and UI transitions follow repo convention
  (untested); the SDK boundary is typed, no `any`.
- **Effects only for external systems:** the room's timer effect synchronizes
  with wall-clock + SDK events (external); phase rendering derives in render.
- **YAGNI enforced:** no keyword-detection code (persona directive covers it),
  no speculative reconnect-stitching, no per-scenario branches — seven
  mechanisms only.

## Open questions (resolved by spikes, not blocking spec approval)

1. Clock anchor → final beat timestamps (spike 1).
2. RPC hosting → Phase 2 shape (spike 2).
3. Transcript tail wait duration (spike 3).
4. Exact visual treatment of the resolve-out transition and deliberation beat
   (design-pass detail during Phase 1 implementation).
