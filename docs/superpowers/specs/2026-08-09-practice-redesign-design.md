# Redline redesign — practice-feedback cutover

**Date:** 2026-08-09
**Status:** Approved design, pending spec review
**Source of truth for visuals:** `public/design-reference/*.html` (nine mocks). Where a screen has no mock (noted below), it keeps its current structure and gets the new skin.

## Goal

Move Redline from the speed-gauge/scoring theme to a clean, minimal, professional practice-feedback app — "the LinkedIn version of ChatGPT." Users give information, practice live with an AI avatar, and leave with feedback and action items. No numeric scoring anywhere. Flow gets more concise. One PR, staged commits, developer reviews in-app between stages and commits personally (Claude never commits).

## Product model

The core noun is a **practice**: a persistent coaching thread with one lane (domain pack) and one persona. It is the sticky object — the user returns to it and it remembers them.

- A practice holds: name, lane (`packId`), persona, the confirmed brief, attached documents, the **working list** (open action items the persona follows up on), and the **gap map** ("still unproven": risks + open questions).
- A practice contains **sessions** — one live room conversation each, ending in a **debrief**: spoken verdict quote, qualitative verdict tier, "what happened in there," "what held up / what didn't," and new action items.
- "Up from last time" is direction only, derived by comparing verdict tiers across a practice's sessions. No numbers.

### Schema v2 (clean cutover, DB wiped)

Old tables `ideas`, `simulations`, `rooms`, `reports`, `audits` are replaced. No migration; existing data is disposable practice data.

- `users` — unchanged: `clerkId`, `displayName`, `lanes[]`, `defaultLane`, `termsAcceptedAt/Version`.
- `practices` — absorbs ideas + simulations + audit-as-gap-map + continuity:
  `userId`, `name`, `packId`, `personaId?`, `status: draft | shaping | ready`,
  `scope` (record keyed by pack scopeFields), `context?` (shaped brief, keyed by pack contextFields),
  `gapMap?: { risks: [{ref?, text}], questions: [{text}] }`,
  `continuity?: { lastSessionSummary, actionItems: [{id, text, priority: high|medium|low, status: open|done|dropped, fromSessionId, createdAt}] }` (cap 10),
  `createdAt`, `updatedAt`. Index `by_user`.
- `sessions` — absorbs rooms, debrief embedded:
  `practiceId`, `userId`, `persona` snapshot (id, name, role, avatarId), `transcript[]`, `liveNotes[]`, `currentTopic?` (free text replacing the axis-based indicator), `status: live | concluded`, `startedAt`, `endedAt?`,
  `debrief?: { verdict, spokenVerdict: {speakerName, text}, whatHappened, heldUp: [{quote, why}], didntHold: [{text, ref?}], title?, durationMin? }`.
  Indexes `by_practice`, `by_user`. Debrief generation also merges fresh action items into `practices.continuity`.
- `materials` — attached to practice instead of simulation: `practiceId`, `storageId`, `name`, `fileType`, `status`, `text?`. Index `by_practice`.
- `avatars` — unchanged.

**Deleted concepts:** `riskScores`, `overallScore`, per-panelist scores, axes (`axes.ts` per pack), `READY_LINE`, `readiness.ts`, `preRunScores.ts`, `trajectory.ts`, `ReadinessGauge`, `TrajectoryChart`, sparklines, severity bars, benchmarks. Domain packs slim to: scopeFields, contextFields, personas, qualitative verdict tiers (ordered, for direction), prompts, briefing, copy (incl. wait-screen copy), audit catalog.

All Convex functions keep the existing guard pattern (`requireIdentity`, ownership scoping per user).

## Information architecture & routes

Persistent left sidebar (264px, ChatGPT-style): logo, "New practice" button (`N` shortcut), practices grouped by lane (Founder / Sales / Audit) with open-item counts, user footer (settings, theme toggle, sign out). Lanes the user hasn't enabled show per `users.lanes`; "Add a lane" affordance per welcome-audit mock.

| Route | Mock | Content |
|---|---|---|
| `/` | redline-landing.html | Home: date + greeting, "Pick up where you left off" resume hero (persona waiting on open items, Continue CTA via continue-run machinery), "Your practices" card grid + dashed New card. |
| `/welcome` | redline-welcome.html, redline-welcome-audit.html | First-run: single-lane hero variant when one lane, three-room chooser when multiple. How-it-works strip, fineprint. Replaces current radio-card onboarding. |
| `/p/[practiceId]` | redline-home.html | Practice detail: header (persona avatar, title, lane badge, Continue), "To work on" checkable list + docs footer, "Sessions" list (newest first, verdict pill, quote, meta), "Still unproven" rail (risks + open questions, collapsible below 1200px). |
| `/p/[practiceId]/s/[sessionId]` | redline-debrief.html | Session debrief: verdict quote hero, "What happened in there," "Added to your list" keep/drop items, "Under pressure" rail (held up / didn't), CTAs (save & back, practice again, read transcript). Full transcript on this page (replaces separate replay page). |
| `/new` | redline-new-practice (1).html | Wizard beat 1: lane chips, voice-first mic ("Tell it"), "Type it instead" → full structured per-lane form (fields, chips, evidence preview for audit, upload) that skips confirm. "Add documents" entry. |
| `/new` (confirm beat) | redline-new-practice (1).html beat 2 | Voice path only: "Here's what we heard" extraction rows with "Not heard" pills, per-lane confirm chips, docs row, CTA to meet persona. |
| *(shaping wait)* | **no mock** | The analyzing screen (current `AnalysisPipeline`/`WaitingScreen`, pack-driven rows/work/ticker) keeps its structure and behavior; new skin only. Runs after intake to shape the brief and build the gap map. |
| `/p/[practiceId]/meet` | redline-panel.html | Founder: "Who do you want to face first?" trio with recommended card. Sales/audit: single "meet" card ("She's read everything," docs chips, gap-map count). Consent fineprint. Creates session, enters room. |
| `/p/[practiceId]/room` | redline-room.html | Always dark. Left rail: selfview, mute, "if you're stuck" sentence starters, AI disclaimer. Stage: avatar video, REC timer, name/role, live wave, controls (mute, pause-to-think, topic chip from `currentTopic`, End session). Right rail: live transcript + live notes. |
| `/settings` | no mock | Lanes, account deletion, theme — restyled, reached from user menu. |
| `/sign-in`, `/privacy`, `/terms` | no mock | Restyled to new palette (Clerk appearance vars, LegalShell). |

**Removed pages:** `/ideas`, `/ideas/[id]`, `/sessions`, `/sessions/[roomId]`, `/reports`, `/panel`, `/materials`, `/benchmarks`, `/help`, and old flow routes `/simulation/new`, `/simulation/[id]/{analyze,audit,panel,room,report}`. Analyze/audit cease to exist as pages — shaping happens inside the wizard (with the wait screen), the gap map lives on the practice. Navigation surface is: sidebar practices + Home; everything else is one click deep inside a practice.

## Flow (4 beats, was 6 stages)

1. **Tell it** — mic capture (existing PitchRecorder + AssemblyAI transcribe), or structured typed form per lane.
2. **Confirm** — voice path only: shaped "what we heard" with gaps ("a gap is a finding, not a failure"), confirm chips, docs.
3. **Meet** — persona intro (choice for founder, single for sales/audit), consent, enter room.
4. **Room → Debrief** — end session generates debrief; land on session page; keep/drop items; back to practice.

Wizard top bar: logo, `TELL IT ─ CONFIRM` mono stepper (later `BRIEF ─ PRE-READ ─ ROOM`), "Save & exit." Returning users: resume hero on Home or Continue on practice header (reuses `continueRun` semantics: rejoin live session rather than minting a new one; clone brief into a fresh session otherwise).

## Design system

- **Fonts** via `next/font/google`: Instrument Sans (UI), Source Serif 4 (persona voice: quotes, verdicts, session quotes), Spline Sans Mono (meta, timestamps, kickers, refs). Remove Archivo + IBM Plex.
- **Tokens:** mock palette verbatim as CSS custom properties in `globals.css` `@theme` — `--paper --panel --card --ink[-2/-3/-4] --line --line-2 --hover --press --brand --accent(+hover/bg/line) --audit --sales --founder (+bg/line each) --ok(-bg) --warn(-bg/-line) --shadow-btn --shadow-card`. Light + dark palettes; `next-themes` with system default and manual toggle in the user menu. Room forced dark. shadcn semantic tokens remap onto these primitives.
- **Shape & texture:** radii 9–18px per mock scale, soft shadows, pill badges/chips, `rise` load choreography, reduced-motion respected. Kill: 0-radius, film grain, red selection, gauge/needle animations, `data-surface` two-surface system (replaced by theme + forced-dark room).
- **Brand red** survives only as the logo mark accent. Primary action color is the blue `--accent`.
- **Primitives:** consolidate to shared Button (primary/ghost/icon), Card, Badge, Chip, checkable list-item so pages stop hand-rolling; keep the shadcn components that are actually used (input, textarea, scroll-area, tooltip, alert-dialog), delete unused ones.

## Staged commits (one PR)

| Stage | Lands | Review gate |
|---|---|---|
| 1 | Fonts, tokens (light+dark), next-themes, base primitives, restyle existing chrome (rail, topbar, flow header, wait screen skin) | App reskinned, old structure intact |
| 2 | Schema v2 + Convex rewrite, DB wipe; new sidebar, Home, Welcome, Practice detail; delete old workspace pages; minimally adapt existing wizard so the loop works end-to-end | New shell + thread model functional |
| 3 | New-practice wizard: Tell it → Confirm + structured forms + shaping wait screen | Creation experience |
| 4 | Meet screen + Room redesign | Live session |
| 5 | Debrief + session page, practice-detail polish (working list, still-unproven) | Feedback loop |
| 6 | Settings/sign-in/legal restyle, dead-code sweep, copy pass, prod polish | Final |

Stage 2 is the big-bang backend swap — leaner than running both schemas in parallel since the DB is disposable. Developer reviews and commits after each stage.

## Out of scope

- Marketing/landing page (app is invite-only; none mocked).
- Multi-panelist simultaneous rooms (still 1-on-1 per session).
- Any numeric scoring, benchmarks, or trajectory features.
- Mobile-native layouts beyond the mocks' responsive behavior (sidebar hides < 820px).
