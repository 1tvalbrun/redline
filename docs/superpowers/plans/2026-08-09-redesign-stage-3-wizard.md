# Redesign Stage 3 — New-Practice Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the intake (BriefForm/ScopeForm) with the mock wizard: voice-first "Tell it" → "Here's what we heard" confirm, or "Type it instead" → structured per-lane form that skips confirm. All three lanes get voice intake.

**Architecture:** One generic wizard driven by `pack.scopeFields` (they already match the mock's typed forms 1:1). Voice path: record (AssemblyAI streaming, logic extracted from PitchRecorder into a hook) → per-pack extraction action → confirm UI → `practices.create` → analyze → existing `/analyze` wait screen. Typed path: same fields as a form → create directly. Route stays `/simulation/new` (renames batched in Stage 6); chrome stays `FlowShell` (the mock's TELL IT/CONFIRM micro-stepper is superseded by the flow stepper until Stage 4 consolidates stages).

**Mock:** `public/design-reference/redline-new-practice (1).html` (canonical). Em-dash-free copy per the developer's rule.

## Global Constraints

- NEVER commit; one-line commit messages are the developer's job.
- No semicolons; const arrows; `Handle` prefix; early returns; Tailwind only; no TODOs; strict TS.
- No em dashes in user-visible copy or model output contracts.
- Loading/empty/error states explicit; reactive-query flashes guarded (learn from PanelSetup).
- Verify per task: `pnpm lint && pnpm test && pnpm build`; `npx convex dev --once` after backend changes.

---

### Task 1: Generic scope extraction (backend + lib)

**Files:**
- Modify: `src/lib/intake.ts` — replace founder-only `parseExtractedBrief` with `parseExtractedScope(raw: unknown, fields: ScopeField[]): Scope`:
  strings trimmed/clamped to `maxLength ?? 60` (textarea 600); chips accept only option labels (else dropped); multi filters to option labels, caps 8; null/absent keys omitted (that's "Not heard"). TDD in `src/lib/intake.test.ts` (rewrite): happy path, paraphrase chip dropped, clamping, garbage → `{}`.
- Modify: `convex/practices.ts` — `extractBrief` becomes `extractScope({ packId, pitch, source })`; validates packId, calls `pack.prompts.extractScope`, returns `parseExtractedScope` result.
- Modify: each pack's `prompts.ts` — add `extractScope(input: { source: "voice" | "deck"; pitch: string }): string`. Contract: return JSON keyed by that pack's scope-field keys; every value a string (multi fields: array of strings); use null for anything the speaker did not say; chip fields must use one of the listed option labels verbatim or null; never invent content; no em dashes. Founder's existing `extractBrief` prompt is the model — port its honesty rules, then delete it. `src/domains/types.ts`: replace `extractBrief?` with required `extractScope` on the prompts contract.
- Update pack prompt tests: assert extractScope names the pack's field keys and contains the never-invent rule.

### Task 2: Voice capture hook

**Files:**
- Create: `src/components/simulation/intake/useVoiceCapture.ts` — extract from `PitchRecorder.tsx`: mic permission, AssemblyAI token fetch + websocket stream, elapsed seconds, accumulated transcript, error states (mic blocked, connection lost). Returns `{ status: "idle" | "recording" | "error", transcript, seconds, error, start, stop }`. UI stays out of the hook.

### Task 3: Wizard UI

**Files:**
- Rewrite: `src/app/(flow)/simulation/new/page.tsx` — owns wizard state: `lane` (from `?lane=` → `user.defaultLane`, switchable via centered lane chips when `user.lanes.length > 1`), `mode: "tell" | "type" | "confirm"`, `heard: Scope | null`, `uploads`. Renders inside `FlowShell stage="brief"`.
- Create: `src/components/simulation/intake/TellIt.tsx` — mock beat 1: per-lane heading/sub (new `pack.copy.tellIt {heading, sub}`), 84px round mic button (blue idle, red + ring animation + mono timer + "I'm done" while recording, via `useVoiceCapture`), alt row "Type it instead" / "Add documents" (documents jumps to typed form with the upload row focused). Mic-blocked error offers typing.
- Create: `src/components/simulation/intake/ScopeFields.tsx` — the one field renderer both paths share: text/textarea (mock `.field` style), chips (single-select pill groups), multi (toggle pills), plus the audit evidence panel: when the pack has `evidenceRequests` and the area chip field has a value, render the request list (mono refs + text) with the "anything missing becomes a finding, not a surprise" sub-line.
- Create: `src/components/simulation/intake/TypedForm.tsx` — mock typed form: "Talk it instead" pill back to mic, `ScopeFields` for all fields, materials upload (reuse `materialUploads.tsx`), footer CTA (personas.length > 1 ? "Choose your panel" : "Meet {first name}") + hint; submits `practices.create` → `analyze` (fire) → `/simulation/{id}/analyze`.
- Create: `src/components/simulation/intake/ConfirmBrief.tsx` — mock beat 2 (voice only): "Change what you said" back link, "FROM YOUR RECORDING · m:ss" src line, "Here's what we heard" + "a gap is a finding, not a failure" sub; heard card = one row per text/textarea field (value, or muted "You didn't mention this" + "Not heard" pill; pencil toggles an inline input); chip/multi fields render as confirm chip groups below via `ScopeFields`; docs row; same CTA/submit as TypedForm. Required-but-missing fields block submit with the field highlighted, not a thrown error.
- Delete: `BriefForm.tsx`, `ScopeForm.tsx`, `PitchRecorder.tsx` (fully replaced). Sweep imports.

### Task 4: Copy + catalog sweep

- Add `tellIt` copy per pack (mock headings/subs, em-dash-free). Remove dead `IntakeCopy`/`copy.intake` if nothing consumes it after ScopeForm dies.
- `src/domains/audit/catalog.ts` + `evidenceRequests`: rewrite em dashes in strings that now render on screen (ERL items); leave spoken/prompt-only text.

### Task 5: Gate

- [ ] `pnpm lint && pnpm test && pnpm build`; walkthrough: voice path (record → confirm with a real gap → edit a row → create), typed path per lane, audit ERL appears on area pick, `?lane=` deep links, mic-permission-denied path, both themes. Report; developer commits.
