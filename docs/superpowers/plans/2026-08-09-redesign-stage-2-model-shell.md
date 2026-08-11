# Redesign Stage 2 — Practice Model + App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the idea/simulation/room/report model with the practice/session model (schema v2, no scoring, DB wiped), and build the new app shell: sidebar with practices by lane, Home, Welcome, practice detail. Old workspace pages are deleted; the flow keeps working end-to-end against the new model with its current UI.

**Architecture:** `practices` absorbs ideas + simulations + audits (as an embedded `audit` field) + continuity; `sessions` absorbs rooms with the debrief embedded (no reports table). One practice = one durable thread with one brief and one persona; sessions repeat against it. Flow routes stay at `/simulation/[id]/*` this stage with `[id]` now a practice id; Stages 3–5 rebuild those pages and move routes.

**Tech Stack:** Convex (schema + functions), Next.js 16 App Router, existing domain-pack system (slimmed), mock references `public/design-reference/{redline-landing,redline-welcome,redline-welcome-audit,redline-home}.html`.

**Spec:** `docs/superpowers/specs/2026-08-09-practice-redesign-design.md`.

## Global Constraints

- **NEVER commit.** Developer reviews in-app and commits at the stage gate.
- No semicolons; const arrows; `Handle` prefix on handlers; early returns; Tailwind utilities only; no TODOs.
- Every public Convex function calls `requireIdentity`; single-doc reads go through `ownedOrNull`.
- No numeric scoring anywhere: no riskScores, overallScore, axes, READY_LINE, trajectory.
- The dev DB is wiped **except `avatars` and `users`** (avatar registrations are hand-provisioned; users keeps the developer signed in — clearing it just re-runs onboarding).
- Verification: `pnpm lint`, `pnpm test`, `pnpm build`, plus `npx convex dev --once` pushes the schema cleanly.

---

### Task 1: Carry-overs — LogoMark + one primary-button constant

**Files:**
- Create: `src/components/shared/LogoMark.tsx`
- Create: `src/components/shared/buttons.ts`
- Modify: `src/components/layout/AppRail.tsx`, `src/components/simulation/flow/FlowShell.tsx`, `src/app/providers.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx` (replace hand-built marks)
- Delete: `src/components/workspace/cta.ts` (consumers updated in later tasks; delete once nothing imports it)

**Interfaces:**
- Produces: `LogoMark({ size?: "sm" | "md" })` — sm = 22px (flow header, sign-in), md = 24px (sidebar); the black rounded square with red bar, `aria-hidden`.
- Produces: `BTN_PRIMARY` in `buttons.ts` — the single mock btn-primary class string (current `FLOW_BTN` value). `FlowShell` re-exports `FLOW_BTN = BTN_PRIMARY` until Stage 3–5 retire its consumers; `WORKSPACE_CTA` imports are replaced with `BTN_PRIMARY` directly.

- [ ] Extract the component, swap all four call sites, collapse the constants, `pnpm lint && pnpm build`.

### Task 2: Slim the domain packs — no axes, no scores

**Files:**
- Modify: `src/domains/types.ts` (drop `axes`, `targetLine`, axis-typed helpers; `ActionItem` gains `priority: Priority`)
- Modify: `src/domains/registry.ts` (drop `axisKeys`, `axisLabel`, `axisOwners`)
- Delete: `src/domains/{founder,sales,audit}/axes.ts`
- Modify: each pack's `pack.ts` (remove axes/targetLine), `personas.ts` (remove axis ownership fields), `prompts.ts` (see below), `briefing.ts` (rename args idea→practice/room→session where they leak)
- Delete: `src/lib/readiness.ts`, `src/lib/preRunScores.ts`, `src/lib/trajectory.ts` + their tests
- Modify: `src/lib/audit.ts` stays (claims/gaps validators unchanged)

**Prompt changes (per pack `prompts.ts`):**
- `report(...)` becomes `debrief(...)`: same inputs minus axis data; output contract is JSON `{ title, verdict: { decision, summary }, spokenVerdict, whatHappened, heldUp: [{ quote, why }], didntHold: [{ text, ref? }], continuity: { summary, actionItems: [{ text, priority }] } }`. No scores, no nextSevenDays (action items replace it), no panelVerdict block.
- Orchestrator prompt (`convex/orchestrator.ts`): stop requesting/writing risk scores; add optional `topic` (≤5 words, what's being discussed now) to the decision JSON.
- Verdict direction: pack `verdicts.options` stays an ordered array worst→best; "up from last time" = comparing indexes. Add `verdictRank(pack, decision)` helper to `registry.ts`.

- [ ] Update packs + prompts + helpers; fix/delete affected tests (`briefing.test.ts`, `prompts.test.ts` assert the new debrief contract keys and absence of score keys); `pnpm test`.

### Task 3: Schema v2

**Files:**
- Rewrite: `convex/schema.ts`

```ts
practices: defineTable({
  userId: v.string(),
  name: v.string(),
  packId: v.string(),
  personaId: v.optional(v.string()),        // set at meet; sessions snapshot it
  status: v.union(v.literal("draft"), v.literal("shaping"), v.literal("ready")),
  scope: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
  context: v.optional(v.record(v.string(), v.string())),
  audit: v.optional(v.object({              // was the audits table
    status: v.union(v.literal("running"), v.literal("ready"), v.literal("failed")),
    claims: v.array(claimValidator),
    gaps: v.array(gapValidator),
    failureReason: v.optional(v.string()),
  })),
  continuity: v.optional(v.object({
    lastSessionSummary: v.string(),
    actionItems: v.array(v.object({
      id: v.string(), text: v.string(),
      priority: priorityValidator,
      status: actionItemStatusValidator,
      fromSessionId: v.id("sessions"),
      createdAt: v.number(),
    })),
    updatedAt: v.number(),
  })),
}).index("by_user", ["userId"]),

sessions: defineTable({
  practiceId: v.id("practices"),
  userId: v.string(),
  persona: v.object({ id: v.string(), archetypeId: v.string(), name: v.string(),
    role: v.string(), tone: v.string(), avatarId: v.string() }),
  transcript: v.array(/* same entry shape as rooms */),
  liveNotes: v.array(/* same shape */),
  currentTopic: v.optional(v.string()),
  status: v.union(v.literal("live"), v.literal("concluded")),
  endedAt: v.optional(v.number()),
  debrief: v.optional(v.object({
    title: v.string(),
    verdict: v.string(),                    // pack vocabulary
    verdictSummary: v.string(),
    spokenVerdict: v.object({ speakerId: v.string(), speakerName: v.string(), text: v.string() }),
    whatHappened: v.string(),
    heldUp: v.array(v.object({ quote: v.string(), why: v.string() })),
    didntHold: v.array(v.object({ text: v.string(), ref: v.optional(v.string()) })),
  })),
}).index("by_practice", ["practiceId"]).index("by_user", ["userId"]),

materials: /* same, simulationId → practiceId, index by_practice */
users, avatars: unchanged
```

Deleted tables: `ideas`, `simulations`, `rooms`, `reports`, `audits`. `transcriptTypeValidator`/`noteTypeValidator`/`priorityValidator`/`actionItemStatusValidator` stay exported.

- [ ] Rewrite schema (do not push yet — push happens in Task 5 after the wipe).

### Task 4: Convex functions rewrite

**Files:**
- Create: `convex/practices.ts` (replaces `ideas.ts` + `simulations.ts` + `audits.ts`)
- Create: `convex/sessions.ts` (replaces `rooms.ts` + `reports.ts`)
- Modify: `convex/materials.ts`, `convex/ingest.ts` (practiceId), `convex/orchestrator.ts` (no scores, write `currentTopic`, session ids), `convex/users.ts` (untouched), `src/app/api/avatar/connect/route.ts` + `src/app/api/transcribe/token/route.ts` (renamed queries)
- Delete: `convex/ideas.ts`, `convex/simulations.ts`, `convex/rooms.ts`, `convex/reports.ts`, `convex/audits.ts`
- Create: `src/lib/debrief.ts` (parse + bound the debrief model output; unit-tested)

**`convex/practices.ts` surface:**
- `create({ packId, scope, materials? })` → `practiceId` — same scope validation as old `simulations.create`; always inserts a new practice (no same-name merge — "CourtTime · gym pilot" and "CourtTime · school district" are distinct threads); schedules ingest.
- `get({ id })`, `list()` — list returns per practice: id, name, packId, personaId, status, openItemCount, lastSessionAt, lastVerdict, lastQuote (latest debrief spokenVerdict text), sessionCount — feeds sidebar + Home grid + resume hero (most recent practice with a live session or open items).
- `analyze({ id })` action + `setContext`/`setStatus` internals — unchanged logic, new table.
- `runAudit({ id })` action + `setAudit` internal — old `audits.ts` logic writing `practices.audit`.
- `setPersona({ id, personaId })` — written at meet/panel.
- `continueSession({ id })` → `{ sessionId | null }` — live session → rejoin it; else if persona set → new session via `insertSessionForPersona`; else null (caller routes to panel).
- `recordContinuity` internal + `setActionItemStatus` — ported, item ids from sessionId, items carry priority.
- `extractBrief` action — ported verbatim.
- `counts()` — `{ practices, sessions }` for the topbar.

**`convex/sessions.ts` surface:**
- `insertSessionForPersona(ctx, practiceId, userId, pack, personaId)` helper + `create({ practiceId, personaId })` (also patches `practices.personaId`).
- `get({ id })`, `getByPractice({ practiceId })` (list newest-first: id, status, startedAt=_creationTime, endedAt, turns, debrief summary fields), `getLive({ practiceId })` (first live session).
- `addTranscriptEntry` (ported echo-suppression intact), `addLiveNote` internal, `setTopic` internal, `conclude` internal.
- `generateDebrief({ sessionId })` action — ported from `reports.generate`: transcript budget, `groundHeldUp` for `heldUp` quotes, pack-vocabulary verdict fallback, insert-if-absent guard becomes "patch-if-absent" (`session.debrief` already set → return), then `conclude` + `recordContinuity` (items now `{text, priority}`). All score handling deleted. Parsing/bounding lives in `src/lib/debrief.ts` with tests.

- [ ] Write `src/lib/debrief.ts` test first (malformed JSON → fallbacks; verdict outside vocabulary → pack fallback; caps on lengths/counts), then implementation, then the Convex modules; `pnpm test`.

### Task 5: Wipe + push

- [ ] Add temporary `convex/admin.ts` internal mutation `wipeForV2` deleting all rows from `ideas`, `simulations`, `rooms`, `reports`, `audits`, `materials` (NOT users/avatars); run `npx convex run admin:wipeForV2` against dev **before** the schema push; delete `admin.ts`; then `npx convex dev --once` pushes schema v2 clean.

### Task 6: Flow pages re-pointed (current UI, new model)

**Files:**
- Modify: `src/components/simulation/intake/{BriefForm,ScopeForm,PitchRecorder}.tsx` → `api.practices.create/analyze/extractBrief`
- Modify: `src/components/simulation/flow/AnalysisPipeline.tsx` → `api.practices.get/analyze`
- Modify: `src/components/simulation/intake/AuditStage.tsx` → `practices.runAudit` + `practice.audit`; delete the pre-run axis score readout block (scores are gone)
- Modify: `src/components/simulation/intake/PanelSetup.tsx` → `sessions.create`; recommendation without axes: recommend `pack.personas[0]` unless scope's challenge field names a persona's `targets` (packs already tag personas; if absent, first persona)
- Modify: `src/components/simulation/room/RoomShell.tsx` + `TranscriptPanel`/`LiveNotes` → `sessions.*`; axis "under discussion" chip reads `session.currentTopic`; end-session fires `sessions.generateDebrief` then routes to `/p/[practiceId]/s/[sessionId]`
- Modify: `src/components/simulation/report/*` → **delete** `ReportView`/`VerdictStage`/gauge usage; `/simulation/[id]/report/page.tsx` becomes a redirect to the latest session's page
- Modify: `(flow)/simulation/*` pages: `[id]` param is a practice id

- [ ] Re-point, strip score UI, verify the full loop compiles; `pnpm build`.

### Task 7: New shell + Home + Welcome + practice detail

**Files:**
- Rewrite: `src/components/layout/AppRail.tsx` — mock sidebar: LogoMark + wordmark, New practice btn (`N`), one `lane` group per user lane (lane-dot in lane color, practices from `practices.list` as threads with open-count bubble, active by pathname), empty lanes say "Nothing yet", user footer (avatar chip, name, ThemeToggle, settings gear link)
- Rewrite: `src/app/(app)/page.tsx` — Home per redline-landing.html: mono date + "Good {daypart}, {name}" · resume hero (top practice from `practices.list` with open items or recent session; persona initials avatar, ok-dot, "{persona} is waiting on N items", Continue → `continueSession`) · "Your practices" grid (pcard: title, lane badge, persona line, status/quote line, meta footer, open pill) + dashed New card
- Rewrite: `src/app/welcome/page.tsx` — per redline-welcome(-audit).html: single-lane hero variant when `ALL_PACKS.length` available to user is 1 (or their invite lane), 3-room chooser otherwise; keeps the existing terms-acceptance mutation and Disclosure; choosing a lane runs onboarding then routes to `/simulation/new?lane=`
- Create: `src/app/(app)/p/[practiceId]/page.tsx` — per redline-home.html: header (persona avatar + name + lane badge + Continue btn + subtitle) · "To work on" checkable list (`setActionItemStatus`, priority tags, docs footer from materials) · "Sessions" list (debrief title, verdict pill, when, spokenVerdict quote, meta; quiet rows for no-debrief sessions) · "Still unproven" rail (audit gaps refs + open questions from context, collapsible toggle < 1200px)
- Create: `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` — minimal this stage: verdict quote hero + whatHappened + heldUp/didntHold lists + transcript (reuse `TranscriptPanel` on light surface); Stage 5 polishes to the full debrief mock
- Modify: `src/app/(app)/layout.tsx` — crumb map: Home / Practice / Session / Settings; counters use `practices.counts`
- Delete: `src/app/(app)/{ideas,sessions,reports,panel,materials,benchmarks,help}/` (all pages), `src/components/workspace/{IdeaList,TrajectoryChart,CommitmentsPanel,StubPage}.tsx`, `src/components/shared/ReadinessGauge.tsx`
- Modify: `src/app/(app)/settings/page.tsx` — keep, restyle destructive button to `rounded-[10px] bg-red` pill; lane management unchanged
- Modify: `src/lib/routes.ts` / `src/proxy.ts` if they enumerate deleted routes

- [ ] Build pages against `practices.list`/`getDetail`-equivalents; delete old pages/components; `pnpm lint && pnpm test && pnpm build`.

### Task 8: Stage gate

- [ ] Full loop walkthrough on dev: welcome → new practice (form) → analyze wait → audit → panel → room → end session → debrief page → practice detail shows session + items → Home resume hero → sidebar threads. Both themes. Report to developer with what to review; **do not commit**.

## Self-review notes
- Spec coverage: schema v2 ✓ (T3), function rewrite ✓ (T4), wipe ✓ (T5), shell/Home/Welcome/practice detail ✓ (T7), old pages deleted ✓ (T7), flow loop functional ✓ (T6), carry-overs ✓ (T1), scoring fully out ✓ (T2/T4/T6).
- Types: `Priority` reused from schema exports; `ActionItem.fromSessionId` typed `Id<"sessions">`; debrief shape defined once in schema and mirrored by `src/lib/debrief.ts` parser output.
