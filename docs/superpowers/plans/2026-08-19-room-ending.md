# Room Ending (Smooth Landing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abrupt Runway 5-minute cutoff with a designed ending: server-owned room clock, persona-led wind-down, deterministic UI landing, deliberation beat, and hardened connect route.

**Architecture:** A pure time/phase library in `src/lib` is the single source of landing math. Convex stamps `roomStartedAt` once at first connect claim and returns the remaining budget; the connect route passes it to Runway as `maxDuration`, appends the persona's ending contract, and registers two avatar→client events. RoomShell derives phases from absolute timestamps and lands the plane at T-10s no matter what the model or user does.

**Tech Stack:** Next.js 16 App Router, Convex, `@runwayml/sdk`, `@runwayml/avatars-react`, node:test.

**Spec:** `docs/superpowers/specs/2026-08-19-room-ending-design.md` (read it first; this plan implements Phase 0 + Phase 1 + spikes 1 & 3; Phase 2 / spike 2 is a later plan).

## Global Constraints

- **NEVER commit.** CLAUDE.md forbids it: the developer is the only one who commits, after reviewing the diff. Every "commit" a generic workflow would do is replaced by: leave the work in the tree, report done. No `git add`, no `git commit`, no `git stash`.
- No semicolons. Const arrow functions only. `Handle` prefix on event handlers. Early returns. TypeScript strict, no `any`.
- Tailwind utility classes only; theme tokens from `globals.css` (`text-on-surface-2`, `border-line`, `bg-surface-raised`, `focus-ring`, etc. — copy the patterns already in RoomShell).
- `src/lib` intra-imports in test files use the `.ts` extension (`from "./roomClock.ts"`); Convex files import from `../src/lib/...` extensionless.
- Tests: `pnpm test` (node --test). Typecheck: `pnpm exec tsc --noEmit`. Lint: `pnpm lint` (4 pre-existing warnings in generated files are not yours).
- No numeric countdowns anywhere in the room UI. Ending copy contains no em dashes.
- Every public Convex function keeps `requireIdentity` + `ownedOrNull` (convex/guard.ts). No new indexes.

---

### Task 1: Spike — clock anchor, maxDuration, transcript tail (throwaway)

Measures three unknowns. Output is numbers written into the spec's Open Questions section, not kept code. **Costs ~$0.25 of Runway credits (one short real session).**

**Files:**
- Modify (temporarily): `src/app/api/avatar/connect/route.ts:134-141`
- Modify (spec, permanent): `docs/superpowers/specs/2026-08-19-room-ending-design.md`

- [ ] **Step 1: Add temporary instrumentation to the connect route**

In `route.ts`, change the session create call (line ~134) to add `maxDuration` and timestamps:

```ts
  const createdAtMs = Date.now()
  const session = await client.realtimeSessions.create({
    model: "gwm1_avatars",
    maxDuration: 60,
    avatar: { type: "custom", avatarId },
    ...(personality ? { personality } : {}),
    startScript: briefing.startScript,
  })
  console.log(`[spike] created=${createdAtMs} id=${session.id}`)
```

And after the READY poll loop (line ~152):

```ts
  console.log(`[spike] ready=${Date.now()} id=${session.id}`)
```

- [ ] **Step 2: Run one manual session**

Run `pnpm dev`, open a practice, enter the room, and speak until the session dies. Note wall-clock times from the dev server log (`created`, `ready`) and from the browser: the moment video appears, and the moment the session ends. In the browser console, note the timestamps of the last transcription entries arriving *after* the video died (TranscriptBridge writes them; watch the Convex dashboard's session document or add a temporary `console.log` in `src/components/simulation/room/TranscriptBridge.tsx` next to its `addTranscriptEntry` call).

- [ ] **Step 3: Record findings in the spec**

In the spec's "Open questions" section replace items 1 and 3 with measured values:
- Anchor: cutoff happened N seconds after `created` / `ready` / video-appeared (whichever it tracks).
- `maxDuration: 60` honored: yes/no (session died at ~60s, not 300s).
- Transcript tail: last final arrived N ms after session end → set `TRANSCRIPT_TAIL_MS` (Task 9) to that value + 1000, minimum 2000.

If the anchor is `created` (not connect), also record the measured created→video gap; Task 2's `ANCHOR_MARGIN_MS` must be set to that gap rounded up to the next second.

- [ ] **Step 4: Revert the route instrumentation**

`git diff src/app/api/avatar/connect/route.ts` must be empty (and remove any TranscriptBridge logging). The spec edit stays.

---

### Task 2: `src/lib/roomClock.ts` — landing math (TDD)

**Files:**
- Create: `src/lib/roomClock.ts`
- Create: `src/lib/roomClock.test.ts`

**Interfaces:**
- Produces: `ROOM_MS`, `RESOLVE_MS`, `MIN_RECONNECT_MS`, `ANCHOR_MARGIN_MS`, `type RoomTimePhase`, `roomTimePhase(roomStartedAt, now, roomMs?)`, `remainingMs(roomStartedAt, now, roomMs?)`, `shouldInvite(roomStartedAt, now, roomMs?)`, `maxDurationSec(roomStartedAt | undefined, now, roomMs?)`, `pickInvitation(seed, personaFirstName)`. Consumed by Tasks 5, 7, 8, 9.

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  ROOM_MS,
  RESOLVE_MS,
  MIN_RECONNECT_MS,
  roomTimePhase,
  remainingMs,
  shouldInvite,
  maxDurationSec,
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

test("invitations rotate by seed, name the persona, and contain no digits or em dashes", () => {
  const picks = new Set(
    Array.from({ length: INVITATIONS.length }, (_, i) => pickInvitation(i, "Marcus"))
  )
  assert.equal(picks.size, INVITATIONS.length)
  for (const line of picks) {
    assert.doesNotMatch(line, /[0-9—]/)
  }
  assert.match(pickInvitation(0, "Marcus"), /Marcus|thought|home|closing/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test 2>&1 | grep -A2 roomClock`
Expected: FAIL — cannot find module `./roomClock.ts`

- [ ] **Step 3: Implement**

```ts
// All landing math in one place. Times derive from absolute timestamps so
// background-tab timer throttling can't skew the landing (spec: Room Clock).
// ANCHOR_MARGIN_MS: Runway's maxDuration window starts at session create,
// which precedes roomStartedAt (stamped at connect claim) — every deadline
// budgets for that gap. Value measured in the Task 1 spike.
export const ROOM_MS = 300_000
export const RESOLVE_MS = 10_000
export const MIN_RECONNECT_MS = 30_000
export const ANCHOR_MARGIN_MS = 0

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
```

After Task 1: set `ANCHOR_MARGIN_MS` to the measured create→connect gap (if the anchor turned out to be connect-time, leave 0).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all pass, including the pre-existing 147.

---

### Task 3: `src/lib/idleRule.ts` — dead-air state machine (TDD)

**Files:**
- Create: `src/lib/idleRule.ts`
- Create: `src/lib/idleRule.test.ts`

**Interfaces:**
- Produces: `IDLE_PROMPT_MS`, `IDLE_END_MS`, `type IdleState = "active" | "prompt" | "end"`, `idleState(lastActivityAt, now, suspended)`. Consumed by Task 10.

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { idleState, IDLE_PROMPT_MS, IDLE_END_MS } from "./idleRule.ts"

const T0 = 1_000_000

test("active until the prompt threshold, then prompt, then end", () => {
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS - 1, false), "active")
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS, false), "prompt")
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS + IDLE_END_MS, false), "end")
})

test("suspension (mic muted or blocked) pins the state to active", () => {
  assert.equal(idleState(T0, T0 + IDLE_PROMPT_MS + IDLE_END_MS, true), "active")
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test 2>&1 | grep -B1 -A3 idleRule`
Expected: FAIL — cannot find module `./idleRule.ts`

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all pass.

---

### Task 4: `src/lib/ending.ts` — persona ending contract (TDD)

**Files:**
- Create: `src/lib/ending.ts`
- Create: `src/lib/ending.test.ts`

**Interfaces:**
- Produces: `CLOSING_EVENT = "entering_closing"`, `VERDICT_EVENT = "verdict_delivered"`, `endingContract(personaFirstName: string, roomMinutes: number): string`, `withTimeContract(startScript: string, roomMinutes: number): string`, `VERDICT_RESTATE_DIRECTIVE: string`. Consumed by Tasks 6, 7, 9.

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  endingContract,
  withTimeContract,
  CLOSING_EVENT,
  VERDICT_EVENT,
} from "./ending.ts"

test("contract names both client events exactly (route registers tools by these names)", () => {
  const contract = endingContract("Marcus", 5)
  assert.ok(contract.includes(CLOSING_EVENT))
  assert.ok(contract.includes(VERDICT_EVENT))
})

test("contract carries the load-bearing directives", () => {
  const contract = endingContract("Marcus", 5)
  for (const marker of [
    "final question",
    "30 seconds",
    "never introduce a new",
    "debrief",
    "confirm once",
  ]) {
    assert.ok(contract.toLowerCase().includes(marker.toLowerCase()), `missing: ${marker}`)
  }
})

test("startScript contract stays inside Runway's 2000-char limit", () => {
  const long = "x".repeat(1_900)
  assert.ok(withTimeContract(long, 5).length <= 2_000)
  assert.ok(withTimeContract("Welcome.", 5).includes("five"))
  assert.ok(withTimeContract("Welcome.", 3).includes("three"))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test 2>&1 | grep -B1 -A3 ending`
Expected: FAIL — cannot find module `./ending.ts`

- [ ] **Step 3: Implement**

```ts
// The persona's ending contract (spec: Concierge Persona). Appended to the
// session personality override by /api/avatar/connect. One string, tone
// first: every deflection routes the user toward something they are about
// to receive. Client event names must match the tools the route registers.
export const CLOSING_EVENT = "entering_closing"
export const VERDICT_EVENT = "verdict_delivered"

const MINUTE_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
}

export const endingContract = (personaFirstName: string, roomMinutes: number): string => {
  const minutes = MINUTE_WORDS[roomMinutes] ?? String(roomMinutes)
  return `

TIME AND ENDING (strict):
Your session runs exactly ${minutes} minutes and ends automatically. You cannot see a clock, so manage the room by structure, like a real interviewer: an opening, a few sharp probes, then announce your final question, then deliver your closing read.
Your closing read is the climax, not an afterthought. When you begin it, fire the ${CLOSING_EVENT} tool. Keep the close under 30 seconds of speech: first acknowledge specifically what they defended well, then name what did not hold without piling on, and end forward-looking with what you would want to see next time. Never introduce a new attack in the close. When you finish it, fire the ${VERDICT_EVENT} tool.
If the material runs out early, close early rather than stretching.
If they seem rattled or flustered, lead the close with what held and keep the harder truths for their written debrief.
If they raise a big new question late, do not ignore it and do not attempt it: tell them it deserves a real answer and it is going in their debrief.
If they ask for more time, the format is fixed: tell them to hold that thought for next session and that you will remember it.
If they signal they are done (for example "I think that's everything" or "bye"), confirm once that they are ready for your read, then close.
After your close, never reopen the discussion. Respond warmly and briefly, and point to the debrief, ${personaFirstName} style.`
}

// Spoken verbatim at the top of the session: the time contract makes the
// later wind-down a promise kept instead of a surprise. Runway caps
// startScript at 2000 chars; the base script wins if space is short.
export const withTimeContract = (startScript: string, roomMinutes: number): string => {
  const minutes = MINUTE_WORDS[roomMinutes] ?? String(roomMinutes)
  const contract = ` We've got about ${minutes} minutes together, so let's make them count. I'll call time near the end, so when you hear it, land your point.`
  const combined = `${startScript}${contract}`
  return combined.length <= 2_000 ? combined : startScript
}

// Appended to the debrief system prompt (spec: Report as Safety Net) so the
// written verdict never contradicts a close the user already heard.
export const VERDICT_RESTATE_DIRECTIVE = `
If the transcript ends with the panelist delivering a closing verdict, your spokenVerdict and verdictSummary must restate that same close in the same spirit. Do not compose a rival verdict that contradicts what was said aloud.`
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: all pass.

---

### Task 5: Schema — three optional session fields

**Files:**
- Modify: `convex/schema.ts:154-198` (sessions table) and the validator block near line 30

**Interfaces:**
- Produces: `endedReasonValidator` export; `sessions.roomStartedAt?: number`, `sessions.roomClientId?: string`, `sessions.endedReason?` fields. Consumed by Tasks 6, 7, 8, 9, 10.

- [ ] **Step 1: Add the validator next to the other closed vocabularies (after `usageKindValidator`, ~line 43)**

```ts
// How a session's room ended (spec: Care Rules). Stamped at conclusion;
// the future quota policy reads it (short/error sessions may not count).
export const endedReasonValidator = v.union(
  v.literal("verdict"),
  v.literal("time"),
  v.literal("user"),
  v.literal("idle"),
  v.literal("error")
)
export type EndedReason = Infer<typeof endedReasonValidator>
```

- [ ] **Step 2: Add the fields to the sessions table (after `lastOrchestratedAt`, ~line 191)**

```ts
    // Room clock anchor: stamped once at the first successful avatar connect
    // claim, never updated. All landing math derives from it (src/lib/roomClock).
    roomStartedAt: v.optional(v.number()),
    // Latest connecting browser tab; a mismatched live tab yields the room
    // instead of minting a competing avatar session.
    roomClientId: v.optional(v.string()),
    endedReason: v.optional(endedReasonValidator),
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit && npx convex dev --once`
Expected: clean typecheck, schema accepted (all fields optional — no migration).

---

### Task 6: Convex — connect claim stamps the clock; `end` takes a reason; debrief restates the close

**Files:**
- Modify: `convex/usage.ts:70-94` (claimAvatarConnect)
- Modify: `convex/sessions.ts:188-197` (end), `convex/sessions.ts:313-320` (generateDebrief system message)

**Interfaces:**
- Consumes: `maxDurationSec`, `ROOM_MS` from `../src/lib/roomClock`; `VERDICT_RESTATE_DIRECTIVE` from `../src/lib/ending`; `endedReasonValidator` from `./schema` (Task 5).
- Produces: `claimAvatarConnect` args `{ sessionId, clientId: string }` returning `{ allowed: true, maxDurationSec: number } | { allowed: false, reason: "not_found" | "cap" | "complete" }`; `sessions.end` args `{ id, reason?: EndedReason }`. Consumed by Tasks 7, 8, 9, 10.

- [ ] **Step 1: Rewrite `claimAvatarConnect` in `convex/usage.ts`**

Add imports at the top of the file: `import { maxDurationSec } from "../src/lib/roomClock"` and extend the existing schema import with `endedReasonValidator` only if needed elsewhere (it is not needed here). Replace the handler:

```ts
export const claimAvatarConnect = mutation({
  args: { sessionId: v.id("sessions"), clientId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<
    { allowed: true; maxDurationSec: number } | { allowed: false; reason: "not_found" | "cap" | "complete" }
  > => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.sessionId))
    if (!session) return { allowed: false, reason: "not_found" }
    const now = Date.now()
    // Server-owned room clock: reconnects get the remainder; below the
    // floor the room is over — refuse before anything is billed.
    const budget = maxDurationSec(session.roomStartedAt, now)
    if (budget === null) return { allowed: false, reason: "complete" }
    const prior = await ctx.db
      .query("usageEvents")
      .withIndex("by_session_kind", (q) =>
        q.eq("sessionId", args.sessionId).eq("kind", "avatar_connect")
      )
      .take(MAX_CONNECTS_PER_SESSION)
    if (prior.length >= MAX_CONNECTS_PER_SESSION) return { allowed: false, reason: "cap" }
    await ctx.db.patch(args.sessionId, {
      roomStartedAt: session.roomStartedAt ?? now,
      roomClientId: args.clientId,
    })
    await ctx.db.insert("usageEvents", {
      userId: identity.subject,
      kind: "avatar_connect",
      practiceId: session.practiceId,
      sessionId: args.sessionId,
      costUsd: RUNWAY_CONNECT_USD,
    })
    return { allowed: true, maxDurationSec: budget }
  },
})
```

Keep the existing comment block above the constant; extend its last line with: `Latest claim wins the tab: roomClientId is overwritten so a crashed tab can never lock the user out — the older tab detects the mismatch and yields.`

- [ ] **Step 2: Extend `sessions.end`**

```ts
export const end = mutation({
  args: { id: v.id("sessions"), reason: v.optional(endedReasonValidator) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!session) throw new Error("Session not found")
    if (session.status === "concluded") return
    await ctx.db.patch(args.id, {
      status: "concluded",
      endedAt: Date.now(),
      endedReason: args.reason ?? "user",
    })
  },
})
```

Add `endedReasonValidator` to the existing `./schema` import in `convex/sessions.ts`.

- [ ] **Step 3: Append the restate directive to the debrief system prompt**

In `generateDebrief` (line ~318), change the system message content to:

```ts
          content:
            pack.prompts.debrief({
              /* existing args unchanged */
            }) + VERDICT_RESTATE_DIRECTIVE,
```

Add `import { VERDICT_RESTATE_DIRECTIVE } from "../src/lib/ending"` to the imports.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit && npx convex dev --once && pnpm test`
Expected: clean. (Convex plumbing carries no unit tests per repo convention; the budget math it calls is covered by Task 2.)

---

### Task 7: Connect route — clientId, refusal codes, maxDuration, tools, contract, cancel-on-timeout, queued

**Files:**
- Modify: `src/app/api/avatar/connect/route.ts`

**Interfaces:**
- Consumes: `claimAvatarConnect` (Task 6), `endingContract`, `withTimeContract`, `CLOSING_EVENT`, `VERDICT_EVENT` (Task 4), `ROOM_MS` (Task 2).
- Produces: HTTP contract for Task 8 — success body unchanged (`sessionId`, `serverUrl`, `token`, `roomName`); every failure body is `{ error: string, code: "unavailable" | "cap" | "complete" | "queued" | "timeout" | "failed" }` with statuses 503/429/409/503/504/500 respectively.

- [ ] **Step 1: Read `clientId` alongside `sessionId` and thread it into the claim; map refusal reasons to codes**

Replace the claim block (lines ~109-124) with:

```ts
  // Claim before minting: every Runway session is billed, so a session that
  // has hit its connect cap, run out of room time, or errors mid-claim mints
  // nothing (fail closed). The claim is also the usage-meter write and the
  // room-clock stamp. Codes stay distinct so the client can say what
  // actually happened instead of offering a Retry that can never succeed.
  const clientId = req.nextUrl.searchParams.get("clientId")
  if (!clientId) {
    return NextResponse.json({ error: "Missing client id", code: "unavailable" }, { status: 400 })
  }
  const claim = await convex
    .mutation(api.usage.claimAvatarConnect, {
      sessionId: convexSessionId as Id<"sessions">,
      clientId,
    })
    .catch((err) => {
      console.warn("[/api/avatar/connect] connect claim failed:", err)
      return null
    })
  if (claim === null) {
    return NextResponse.json(
      { error: "Couldn't verify the session. Try again.", code: "unavailable" },
      { status: 503 }
    )
  }
  if (!claim.allowed) {
    if (claim.reason === "complete") {
      return NextResponse.json(
        { error: "This session's time is up.", code: "complete" },
        { status: 409 }
      )
    }
    if (claim.reason === "cap") {
      return NextResponse.json(
        { error: "Connection limit reached for this session", code: "cap" },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Unknown avatar", code: "unavailable" }, { status: 403 })
  }
```

- [ ] **Step 2: Pass `maxDuration`, the ending contract, and the client-event tools to session create**

Replace the personality/create block (lines ~126-141) with:

```ts
  const roomMinutes = Math.round(claim.maxDurationSec / 60) || 1
  const contract = endingContract(firstNameOf(authorized.personaName), roomMinutes)
  let personality: string | undefined
  if (storedPersonality) {
    personality = `${turnTaking}${briefing.personalityPreamble}${storedPersonality}${contract}`
    console.log(
      `[/api/avatar/connect] session personality override applied (${personality.length} chars)`
    )
  }

  const session = await client.realtimeSessions.create({
    model: "gwm1_avatars",
    maxDuration: claim.maxDurationSec,
    avatar: { type: "custom", avatarId },
    ...(personality ? { personality } : {}),
    // Replaces the Character's canned opener, which otherwise repeats
    // verbatim every session, including resumes. The time contract makes
    // the wind-down a promise kept instead of a surprise.
    startScript: withTimeContract(briefing.startScript, roomMinutes),
    tools: [
      {
        type: "client_event",
        name: CLOSING_EVENT,
        description:
          "Fire this the moment you begin your closing read, before speaking it.",
      },
      {
        type: "client_event",
        name: VERDICT_EVENT,
        description: "Fire this immediately after you finish speaking your closing read.",
      },
    ],
  })
```

`authorized.personaName` does not exist yet: extend the `SessionContext` type (line ~15) with `personaName: string` and set it in `authorizeSession`'s return from `session.persona.name`. Add `firstNameOf` to the existing `@/domains/types` import, and `import { endingContract, withTimeContract, CLOSING_EVENT, VERDICT_EVENT } from "@/lib/ending"`.

- [ ] **Step 3: Track `queued`, and cancel the session on poll timeout**

Replace the poll loop (lines ~143-152) with:

```ts
  const deadline = Date.now() + 60_000
  let sessionKey = ""
  let sawQueued = false
  while (Date.now() < deadline) {
    const status = await client.realtimeSessions.retrieve(session.id)
    if (status.status === "READY") { sessionKey = status.sessionKey; break }
    if (status.status === "FAILED") {
      return NextResponse.json({ error: "Session failed", code: "failed" }, { status: 500 })
    }
    if (status.status === "NOT_READY" && status.queued) sawQueued = true
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (!sessionKey) {
    // An abandoned session must not hold the org's concurrency slot or run
    // for nobody — cancel is best-effort, the refusal is not.
    await client.realtimeSessions.delete(session.id).catch((err) => {
      console.warn("[/api/avatar/connect] cancel after timeout failed:", err)
    })
    if (sawQueued) {
      return NextResponse.json(
        { error: "All panelists are in session.", code: "queued" },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Session timed out", code: "timeout" }, { status: 504 })
  }
```

Also update the consume-failure return (line ~159) to include `code: "failed"`.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean (the pre-existing 4 generated-file warnings aside).

---

### Task 8: RoomShell — typed connect, refusal-specific views, tab takeover

**Files:**
- Modify: `src/components/simulation/room/RoomShell.tsx`

**Interfaces:**
- Consumes: route codes (Task 7), `claimAvatarConnect` clientId semantics (Task 6).
- Produces: `connectCode` state consumed by Task 9's phase logic (a `complete` code triggers the debrief path).

- [ ] **Step 1: Replace `connectUrl` with a typed `connect` function**

Add state near `mountNonce` (line ~103):

```ts
  // Identifies this tab to the connect claim; the latest claim wins the room
  // and older tabs yield (session.roomClientId mismatch).
  const [clientId] = useState(() => crypto.randomUUID())
```

Add the connect codes type and a callback above `handleAvatarStatus`:

```ts
type ConnectCode = "unavailable" | "cap" | "complete" | "queued" | "timeout" | "failed"

const CONNECT_CODES: ReadonlySet<string> = new Set([
  "unavailable",
  "cap",
  "complete",
  "queued",
  "timeout",
  "failed",
])
```

(module scope, below the constants), then inside the component:

```ts
  // The SDK's connectUrl mode hides the response body, so refusals all look
  // alike. A custom connect surfaces the route's code as the Error message,
  // which avatarFailure maps to honest copy (a capped session must not
  // offer a Retry that can never succeed).
  const handleConnect = useCallback(
    async (avatarId: string) => {
      const res = await fetch(
        `/api/avatar/connect?sessionId=${session._id}&clientId=${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarId }),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.code ?? "unavailable")
      return data
    },
    [session?._id, clientId]
  )
```

Note: `session` is narrowed after the early return at line 142; keep `handleConnect` defined after that narrowing (directly above `handleEndSession`) so `session._id` is safe, and drop the optional chain. Replace the provider prop `connectUrl={...}` with `connect={handleConnect}` and keep `key={connectAttempt}` (each retry still forces a fresh session).

- [ ] **Step 2: Derive the refusal view from the code**

Add below `avatarFailure` (line ~192):

```ts
  const connectCode: ConnectCode | null =
    avatarError && CONNECT_CODES.has(avatarError.message)
      ? (avatarError.message as ConnectCode)
      : null
  const retryImpossible = connectCode === "cap" || connectCode === "complete"
```

Change the failure panel (lines ~228-252): headline stays for generic failures but becomes `"All panelists are in session"` when `connectCode === "queued"`; body copy per code:

- `queued`: `` `${firstNameOf(persona.name)} is finishing another session. You're next: retry in a moment, or end now and get your debrief from what's on the record.` ``
- `cap`: `"This session has reached its connection limit. Your conversation is safe; your debrief comes from what's on the record."`
- `complete`: `"This session's time is up. Your debrief is ready to be written."`
- everything else: the existing interpolated copy, but replace `avatarFailure` in it with a generic sentence when `connectCode` is set (`"The connection didn't go through."`) so raw codes never render.

Render the Retry button only when `!retryImpossible`; the end-session button stays always.

- [ ] **Step 3: Tab takeover view**

Add below the `stale` computation (line ~154):

```ts
  // Another tab claimed the room after this one connected: yield instead of
  // competing for the same avatar session (latest claim wins, by design).
  const takenOver =
    hasConnected && session.roomClientId !== undefined && session.roomClientId !== clientId
```

Render (as the first branch of the main panel, before `sessionOver`): a centered panel matching the `sessionOver` styling with the heading `Open in another window` and body `This session is live in another window. You can keep watching the transcript here, or end and get the debrief.` — and when `takenOver` is true, do not render `AvatarProvider` (the branch replaces it) and pass `enabled={false}` to `UserSpeechBridge` by adding `&& !takenOver` to its condition.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: clean. Then a manual dev check: enter a room, confirm it connects (claim now requires clientId end-to-end).

---

### Task 9: RoomShell — phases, invitation, client events, the landing, deliberation

**Files:**
- Modify: `src/components/simulation/room/RoomShell.tsx`
- Create: `src/components/simulation/room/EndingBridge.tsx`

**Interfaces:**
- Consumes: `roomTimePhase`, `shouldInvite`, `pickInvitation`, `RESOLVE_MS` (Task 2), `CLOSING_EVENT`, `VERDICT_EVENT` (Task 4), `sessions.end` reason arg (Task 6).
- Produces: the complete landing flow. `TRANSCRIPT_TAIL_MS` constant set from Task 1's measurement.

- [ ] **Step 1: Create `EndingBridge` (client events must be consumed inside the provider)**

```tsx
"use client"

import { useClientEvents } from "@runwayml/avatars-react"
import { CLOSING_EVENT, VERDICT_EVENT } from "@/lib/ending"

type EndingBridgeProps = {
  onClosing: () => void
  onVerdictDelivered: () => void
}

// Relays the persona's ending signals out of the provider tree. The events
// may only ever advance the room's phase; the clock remains authoritative
// (a model firing entering_closing at minute two must not delay the landing).
export const EndingBridge = ({ onClosing, onVerdictDelivered }: EndingBridgeProps) => {
  useClientEvents((event) => {
    if (event.tool === CLOSING_EVENT) onClosing()
    if (event.tool === VERDICT_EVENT) onVerdictDelivered()
  })
  return null
}
```

- [ ] **Step 2: Wire the clock and phases into RoomShell**

Constants at module scope:

```ts
// Grace after the persona finishes its close before the room ends itself:
// long enough for a warm sign-off exchange, short enough that the ending
// stays an ending.
const VERDICT_GRACE_MS = 10_000
// Wait for trailing transcription finals before generating the debrief so
// the user's last words make the record. Measured in the clock spike.
const TRANSCRIPT_TAIL_MS = 3_000
```

Inside the component, replace the mount-anchored clock usage with a ticking now and phase derivation (keep `SessionClock` as-is for the elapsed readout):

```ts
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])
  const [modelClosing, setModelClosing] = useState(false)
  const [verdictDeliveredAt, setVerdictDeliveredAt] = useState<number | null>(null)
  const [landing, setLanding] = useState(false)
```

After the `session`/`practice` narrowing:

```ts
  const timePhase = session.roomStartedAt
    ? roomTimePhase(session.roomStartedAt, now)
    : "open"
  // The model's entering_closing signal may only advance the phase.
  const phase = timePhase === "open" && modelClosing ? "closing" : timePhase
  const invitation =
    session.roomStartedAt &&
    shouldInvite(session.roomStartedAt, now) &&
    !isAvatarSpeaking &&
    verdictDeliveredAt === null
      ? pickInvitation(session._creationTime, firstNameOf(persona.name))
      : null
```

- [ ] **Step 3: The landing effect (synchronizes with wall clock and Convex — a real external system)**

```ts
  const handleLand = useCallback(
    (reason: "time" | "verdict" | "idle") => {
      if (ended.current) return
      ended.current = true
      setLanding(true)
      endSession({ id: session._id, reason })
        .then(() =>
          new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_TAIL_MS)).then(() =>
            generateDebrief({ sessionId: session._id })
          )
        )
        .catch((err) => console.error("landing failed:", err))
      setTimeout(() => router.push(`/p/${simulationId}/s/${session._id}`), TRANSCRIPT_TAIL_MS)
    },
    [endSession, generateDebrief, router, session._id, simulationId]
  )

  useEffect(() => {
    if (phase === "resolving" || phase === "over") handleLand("time")
  }, [phase, handleLand])

  useEffect(() => {
    if (verdictDeliveredAt === null) return
    const timer = setTimeout(() => handleLand("verdict"), VERDICT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [verdictDeliveredAt, handleLand])
```

Hook ordering: these hooks must run on every render, so they cannot live below the early return at line 142. Restructure: extract everything below the narrowing into a `RoomShellBody` child component that receives `session` and `practice` as required props (typed non-null) and holds all landing state and hooks. `RoomShell` keeps the queries, the redirect effect, and the narrowing, then renders `<RoomShellBody session={session} practice={practice} />`. This is the least-change way to keep hooks unconditional.

Note `handleEndSession` (the user's own End button) keeps its immediate `router.push` but now passes `reason: "user"` to `endSession` — the user chose to leave; don't hold them for the tail.

- [ ] **Step 4: Render the ending states**

- Mount the bridge inside `AvatarProvider`, next to the other bridges:
  `<EndingBridge onClosing={() => setModelClosing(true)} onVerdictDelivered={() => setVerdictDeliveredAt(Date.now())} />`
- Topic chip (line ~336): when `phase !== "open"`, render `Closing` instead of `{session.currentTopic} under discussion`.
- Invitation: inside `<main>`, above the nameplate block:

```tsx
        {invitation && !landing && (
          <div className="absolute bottom-[110px] left-6 z-[5]">
            <p className="max-w-[34ch] font-mono text-[11px] uppercase tracking-[.12em] text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,.5)] motion-safe:animate-pulse">
              {invitation}
            </p>
          </div>
        )}
```

- Landing overlay (covers the avatar video; renders when `landing` is true, above the provider markup):

```tsx
        {landing && (
          <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center gap-3 bg-[#0e0c0a]/90 backdrop-blur-sm transition-opacity duration-700">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              Time called
            </p>
            <p className="max-w-[38ch] text-center text-[13.5px] text-on-surface-2">
              {`${firstNameOf(persona.name)} is writing up your debrief.`}
            </p>
          </div>
        )}
```

When `landing` is true also stop rendering `UserSpeechBridge` (add `&& !landing`) — the room is over; nothing new goes on the record after the tail.

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: clean. Manual dev check with a temporarily shortened clock: set `ROOM_MS` to `90_000` in `src/lib/roomClock.ts`, run a room end-to-end, watch open → closing → invitation (stay talking) → landing → report. **Revert `ROOM_MS` to `300_000` afterward and re-run `pnpm test` (the phase tests pin the fractions, not the total, so both values pass — the revert is verified by `git diff`).**

---

### Task 10: RoomShell — idle rule and mic banner

**Files:**
- Modify: `src/components/simulation/room/RoomShell.tsx` (RoomShellBody after Task 9)

**Interfaces:**
- Consumes: `idleState`, `IDLE_PROMPT_MS` (Task 3), `lastActivityAt` from `@/lib/session` (already imported), `handleLand` (Task 9).

- [ ] **Step 1: Derive idle state**

```ts
  // Dead air burns money with no ending at all (spec: Care Rules). Suspended
  // whenever the silence can't be attributed to the user: muted or blocked
  // mic, or the persona mid-speech.
  const idle = idleState(
    lastActivityAt(session.transcript, session.roomStartedAt ?? session._creationTime),
    now,
    micState !== "live" || isAvatarSpeaking || landing || session.roomStartedAt === undefined
  )

  useEffect(() => {
    if (idle === "end") handleLand("idle")
  }, [idle, handleLand])
```

- [ ] **Step 2: Render the prompt and the mic banner**

Idle prompt (inside `<main>`, same placement family as the invitation):

```tsx
        {idle === "prompt" && !landing && (
          <div className="absolute left-1/2 top-[18px] z-[5] -translate-x-1/2 rounded-[10px] border border-line-2 bg-black/60 px-4 py-2">
            <p className="font-mono text-[11px] uppercase tracking-[.12em] text-white/85">
              Still there? The session wraps up shortly if the room stays quiet.
            </p>
          </div>
        )}
```

Mic banner: when `micState === "muted"` or `micState === "blocked"` and the session is live, render in the same top-center slot (idle prompt takes precedence; they cannot co-occur since a non-live mic suspends idle):

```tsx
        {(micState === "muted" || micState === "blocked") && !landing && !sessionOver && (
          <div className="absolute left-1/2 top-[18px] z-[5] -translate-x-1/2 rounded-[10px] border border-line-2 bg-black/60 px-4 py-2">
            <p className="font-mono text-[11px] uppercase tracking-[.12em] text-white/85">
              {micState === "blocked"
                ? `We can't reach your microphone. ${firstNameOf(persona.name)} can't hear you.`
                : `Your microphone is muted. ${firstNameOf(persona.name)} can't hear you.`}
            </p>
          </div>
        )}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: clean. Manual dev check: mute the mic in a live room → banner appears, idle never fires; unmute and stay silent 45s → prompt appears.

---

### Task 11: Report page — deliberation copy

**Files:**
- Modify: `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` (the `debriefPending` branch; find the render that gates on it, below line ~90)

**Interfaces:**
- Consumes: the existing `debriefPending` + `showRetry` machinery (already in the file, `RETRY_AFTER_MS = 12_000`).

- [ ] **Step 1: Reframe the pending branch as the deliberation beat**

Locate the pending render (the branch shown while `debriefPending`). Replace its copy so the wait reads as the panelist working, with the honesty shift and retry unchanged in behavior:

- Primary line: `` `${firstNameOf(session.persona.name)} is writing up your verdict.` ``
- Secondary line before `showRetry`: `"Reviewing what held and what didn't."`
- Secondary line once `showRetry` is true: `"Taking a bit longer than usual."` with the existing retry button beneath it.

Raise `RETRY_AFTER_MS` from `12_000` to `30_000` and update its comment: generation on the quality tier measures ~25s; the retry appears only once the wait is genuinely unusual.

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean. Manual dev check: end a session and watch the report page show the deliberation copy until the debrief lands.

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Automated checks**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: typecheck clean, lint shows only the 4 pre-existing generated-file warnings, all tests pass (147 pre-existing + new roomClock/idleRule/ending suites).

- [ ] **Step 2: Deploy schema + functions to the dev deployment**

Run: `npx convex dev --once`
Expected: schema accepted, functions pushed.

- [ ] **Step 3: Manual smoke (dev), one full session**

- Enter a room: connects (clientId flows end-to-end), startScript opens with the time contract.
- Second browser tab on the same room: first tab yields with "Open in another window".
- Let the room run: topic chip flips to "Closing", invitation appears if you keep talking, landing overlay at T-10s, report page shows deliberation copy, debrief arrives, written verdict matches the spoken close.
- `endedReason` visible on the session document in the Convex dashboard.
- Force the cap (5 quick retries): failure view shows the cap copy with no Retry button.

- [ ] **Step 4: Stop**

Leave everything uncommitted. Report results to the developer for diff review — per CLAUDE.md, they commit.
