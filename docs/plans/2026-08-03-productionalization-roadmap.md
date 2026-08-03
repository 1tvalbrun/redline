# Productionalization Roadmap — Engine, Lanes, Continuity

> Master roadmap. Each milestone is independently shippable and gets its own
> task-by-task implementation plan (docs/plans/) when it starts. Sequence is
> load-bearing: every milestone builds on the schemas and interfaces locked here.
> Per CLAUDE.md, no milestone includes commits — work stops in the tree for
> developer review.

**Goal:** Turn the founder-pitch app into a multi-lane practice engine (the
5-step core loop) with first-run onboarding, legal coverage, a data-driven
avatar/persona registry, a second lane (sales), and cross-session continuity —
the subscription retention hook.

**The core loop (engine, never changes per lane):**
Scope → Material → Pre-read → Interrogation → Assessment

**Governing constraints (from docs/engineering-standards.md and CLAUDE.md):**
- Abstract on the second concrete lane, not speculatively; every pack field must
  have a consumer the day it lands
- All authorization at the Convex function layer via the one guard
  (`requireIdentity` / `ownedOrNull`); identity always from
  `ctx.auth.getUserIdentity()`, never from arguments
- Indexes only for queries that exist; `.withIndex` never `.filter`
- Schema enforces invariants (validators, unions); invalid states unrepresentable
- No semicolons; const arrow functions; early returns; Tailwind utilities only;
  Zod at external boundaries; external API calls only in convex actions or /api
  route handlers
- Migrations are additive-field → backfill → cutover → remove; never in-place
  rewrites of live shapes

---

## Milestone 0 — Truth & housekeeping (prep, ~1 session)

Zero user-visible change; removes landmines the later milestones would trip on.

- Fix `CLAUDE.md`: one avatar per room (not "3 simultaneous sessions"); note
  stage↔route name mapping lives in `FlowShell.tsx`
- Clear the Starting Script on all 3 existing Runway characters in the dev
  portal (the app injects per-session `startScript`; the stored one only fires
  on briefing-fetch failure and is wrong there). Verify `buildRoomBriefing`'s
  generic fallback opener still covers the no-briefing path
- Extract one OpenAI helper (`src/lib/openai.ts` consumed from convex):
  `resolveModel(tier: "fast" | "quality")` + client construction — replaces the
  5 copy-pasted `process.env.X ?? Y ?? "gpt-4o-mini"` ladders
- Close the persona-injection seam: `rooms.create` stops accepting
  `systemPrompt`/`tone` from the client; server resolves the persona by id and
  denormalizes it (interim: from `DEFAULT_CHARACTERS`; M2 moves this to the
  registry). Drop the dead `rooms.round` field and dead
  `characters[].systemPrompt` write at the same time (additive-tolerant read,
  stop writing)

**Acceptance:** app behaves identically; grep shows one model-resolution path;
`rooms.create` args no longer include free-text persona fields.

---

## Milestone 1 — Identity, onboarding, legal (the "real app" floor)

New users get a first-run experience, the app gets a user record, and the
product gets terms/privacy coverage before any wider audience touches it.

### Schema

```ts
users: defineTable({
  clerkId: v.string(),            // identity.subject
  displayName: v.optional(v.string()),
  lanes: v.array(v.string()),     // pack ids, e.g. ["founder"] — ARRAY from day
                                  // one: a user is never locked to one lane
  defaultLane: v.string(),
  termsAcceptedAt: v.number(),
  termsVersion: v.string(),       // bump to force re-acceptance
  createdAt: v.number(),
}).index("by_clerk", ["clerkId"])
```

Multi-lane future-proofing costs only this shape: `lanes` is an array, the
engagement (simulation) already carries its own pack id (M2), and nothing else
assumes one-lane-per-user. No lane-switching UI yet — YAGNI until a second
lane exists (M3 adds the chooser).

### Work

- `convex/users.ts`: `getCurrent` (query, by_clerk, null if absent),
  `complete Onboarding` mutation (creates the row; validates lane against the
  pack registry ids; records terms acceptance + version). Both derive identity
  from `ctx.auth` only
- Onboarding route `/welcome`: shown when `users.getCurrent` returns null
  (gate in the `(app)` layout, not middleware — Convex is the source of truth).
  Two steps: (1) who are you / what are you preparing for → lane selection
  (single card today: founder); (2) terms + privacy acceptance checkbox
  (blocking), with the standing AI-disclosure copy shown here first
- Legal pages: `/terms`, `/privacy` — static content routes, public (added to
  middleware's public matcher alongside `/sign-in`). Content from a reviewed
  template; **flag: have a lawyer review before any paid launch.** Privacy
  policy must state: what's stored (transcripts, uploaded materials, scores),
  processors (Convex, Clerk, OpenAI, Runway, AssemblyAI), retention, deletion
- `Disclosure` component (engine-level, every lane inherits): "AI-generated
  practice simulation. It can be wrong. Not professional advice — verify
  independently." Rendered on room + report screens permanently
- Account deletion: `users.deleteAccount` mutation cascading
  ideas → simulations → materials (+ storage blobs) → audits → rooms → reports
  for the caller's own userId, then the users row. Settings page gets its first
  real control. (Privacy page promises it, so it must exist)
- Backfill: on first sign-in after deploy, existing users (you) fall through to
  `/welcome` once — acceptable, no migration script needed

**Acceptance:** fresh Clerk user lands on `/welcome`, cannot reach the app
without accepting terms; `users` row exists after; deletion removes every owned
row and storage object; existing flows untouched afterward.

---

## Milestone 2 — Pack groundwork + avatar registry (the engine seam)

The extraction milestone: the founder experience is repackaged as the first
DomainPack with **zero behavior change**, and avatar identity becomes data so
lane N+1 never needs a rebuild.

### The pack contract (`src/domains/types.ts`)

```ts
type DomainPack = {
  id: string                      // "founder" | "sales" | "pci-dss" …
  label: string                   // onboarding card copy
  speakerLabel: string            // "Founder" — replaces the 3 hardcoded FOUNDER: copies
  personas: Persona[]             // name, role, tone, personalityText, voicePreset, imagePath
  axes: Axis[]                    // { key, label, rubric, ownerPersonaId }
  readyLine: number               // 90 (INVESTOR_READY_LINE generalized)
  verdicts: VerdictVocab          // { values: [string,...], labels, styles }
  scopeFields: ScopeField[]       // brief fields: id, label, kind, options?, required
  prompts: PackPrompts            // intake, analyze, audit, orchestrate, report, briefing
  copy: PackCopy                  // stage headings, waiting screens, empty states
  actionHorizon: { label: string, days: number }   // "7-day plan"
}
```

Founder pack (`src/domains/founder/`) is assembled by **moving** existing
constants (`characters.ts`, `briefOptions.ts`, `AXES`/`AXIS_LABELS`/
`AXIS_TO_CHARACTER`, `INVESTOR_READY_LINE`, the 5 prompt templates, waiting
copy) — not rewriting them. A snapshot test pins each generated prompt against
the current literal output so the extraction provably changes nothing.

### Avatar registry (kills the NEXT_PUBLIC ceiling)

```ts
avatars: defineTable({
  packId: v.string(),
  personaId: v.string(),          // pack-local persona id
  runwayAvatarId: v.string(),
  status: v.union(v.literal("ready"), v.literal("provisioning"), v.literal("failed")),
  personalityHash: v.string(),    // detects repo↔Runway drift
  updatedAt: v.number(),
}).index("by_pack_persona", ["packId", "personaId"])
```

- Internal provisioning action (admin-triggered, not client-callable): creates
  or PATCHes the Runway avatar from the pack's persona file, uploads knowledge
  docs, records ids + hash. Portal becomes a deploy target, not an editor
- `/api/avatar/connect` allowlist reads the registry (server query) instead of
  env vars; `NEXT_PUBLIC_RUNWAY_AVATAR_*` retired after backfilling the 3
  existing character ids into the table
- Client components get `avatarId` from Convex data (rooms already denormalize
  it — plumbing exists)

### Pack id on engagements

- `simulations.packId` populated from the existing (currently unused)
  `roomType` slot: additive field, backfill `"founder"`, then all reads go
  through `getPack(simulation.packId)`. Server validates pack id against the
  registry on create

**Acceptance:** app pixel-identical and prompt-identical (snapshot tests);
creating a 4th avatar = insert a row + run provisioning, no rebuild; grep finds
no `NEXT_PUBLIC_RUNWAY_AVATAR`.

---

## Milestone 3 — Sales lane (second instance proves the engine)

The cheapest real second lane: one persona (skeptical buyer), single-session,
materials = product one-pager, grounding = seller's own claims + a small
objection catalog. Forces exactly the seams M2 prepared, nothing more.

- Schema generalization the lane forces (additive → backfill → cutover):
  - `rooms.scores: v.record(v.string(), v.number())` replaces the literal
    4-key `riskScores` object; axis keys validated against the pack at write
    time inside the mutation
  - `simulations.scope: v.record(v.string(), v.string())` replaces `brief` for
    new engagements (founder pack's scopeFields produce the same 7 keys;
    old rows keep `brief`, read path handles both until backfill completes)
  - Verdict values validated against `pack.verdicts.values` in the mutation
    (schema keeps `v.string()`; the pack is the closed vocabulary)
- Sales pack content: `src/domains/sales/` — persona + personality text
  (authored in repo, provisioned via registry), objection catalog, prompts
  (audit = "supported / thin / missing" against the one-pager; report =
  deal-readiness, "objections survived / objections that broke you"),
  scope fields (what you sell, who you're selling to, deal stage, what to
  pressure), copy
- Onboarding lane chooser now shows two cards; `users.lanes` gains entries;
  lane home scopes lists by the engagement's packId
- One new Runway character created (portal ok; personality text lives in the
  repo first; starting script empty; no cross-persona references)

**Acceptance:** a new user can pick Sales at onboarding, run the full loop
(scope → one-pager upload → pre-read → live objection interrogation → deal
readiness report) with zero founder-domain copy anywhere in the lane; founder
lane unchanged.

---

## Milestone 4 — Continuity engine v1 (the retention hook)

Memory lives in the app; Runway receives it via the per-session `personality`
override (10k chars) + `startScript` (2k chars) already in use.

### Schema

```ts
// on simulations (the engagement) — bounded, so inline beats a join
continuity: v.optional(v.object({
  lastSessionSummary: v.string(),          // ≤ 1,200 chars, written at report time
  actionItems: v.array(v.object({          // cap 10 open
    text: v.string(),
    status: v.union(v.literal("open"), v.literal("done"), v.literal("dropped")),
    fromRoomId: v.id("rooms"),
    createdAt: v.number(),
  })),
  updatedAt: v.number(),
}))
```

### Work

- `reports.generate` additionally produces the continuity summary + action
  items (same model call, two more JSON fields, same sanitization discipline —
  lengths clamped, statuses validated) and writes them via an internal mutation
- Briefing compiler v2 (`src/lib/roomBriefing.ts` → engine module):
  compose persona preamble + continuity (summary, open action items) + this
  session's scope into ≤ 10k chars with an explicit priority order so overflow
  drops the right things; `startScript` becomes the how'd-it-go opener when
  open action items exist: "Last time you committed to X — walk me through
  what happened"
- Action-item review UI on the lane home / engagement page: mark done/dropped
  (mutation validates ownership + status transition); done items feed the next
  briefing as wins
- Longitudinal scoring: the existing trajectory chart generalized to the
  pack's axis record — score-over-sessions per engagement (data already
  exists per report; this is a read-path change)

**Acceptance:** end a session, return later → the avatar opens by following up
on the last session's commitments without re-introduction; action items are
reviewable and their status round-trips into the next briefing; trajectory
renders for both lanes.

---

## Milestone 5 — Multi-session programs + PCI lane (needs Mosi's materials)

Blocked on: sanitized transcript, completed evidence request list, slide deck,
his credibility criteria. He is the named SME reviewer; audits are in English.

- Programs: rooms become N-per-engagement, each with
  `scope: v.array(v.string())` (control ids); a pack-configured planner
  partitions selected control areas into an interview sequence; reports become
  per-room + an engagement rollup (per-control: solid / shaky / gap /
  not-practiced). The report-per-simulation insert-if-absent guard moves to
  per-room keying
- Control catalog (`src/domains/pci-dss/controls.ts`): id, title,
  **restatement** (not verbatim standard text — PCI SSC copyright; resolve
  licensing before any verbatim use), evidence expected, interview questions
  from the transcript backbone
- Control-id grounding: every LLM-emitted control reference validated against
  the catalog exactly like `groundAudit` validates citation markers — unknown
  control ⇒ dropped. The assessor persona defers on out-of-scope controls
  rather than improvising
- Language rule: practice-readiness verdicts only; never a compliance opinion
- Eval harness: scripted good/evasive/bad answers per control → interviewer +
  report outputs → SME sample review, sign-off gate before the lane is
  listable in onboarding; provenance line on reports ("Interview backbone
  reviewed by [Mosi], [date], pack v[x]")
- Avatar-level knowledge docs = stable framework layer (≤ 50k tokens);
  per-session override = the controls in scope for this interview. User data
  never goes in avatar documents (they're shared across all users)

**Acceptance:** an auditor-in-training runs a multi-interview program across
days with continuity between interviews, and the rollup shows per-control
readiness; every control reference in every output resolves to the catalog.

---

## Milestone 6 — Hardening & subscription readiness (after M4 proves retention)

Not designed in detail yet — listed so the sequence has a destination:

- Billing (Clerk billing or Stripe): free tier caps (engagements/sessions),
  subscription unlock; entitlement checks server-side in the guard layer
- Ops: error monitoring, Convex prod deployment hygiene, Clerk production
  instance + custom domain, rate limiting on the two /api routes, Runway
  tier/concurrency/cost review at expected usage
- Open Restricted mode when ready for self-serve sign-ups (legal pages from M1
  are the prerequisite, already met)

---

## Sequence rationale

M0 clears landmines. M1 is the floor a real app stands on (identity, consent,
deletion) and everything later hangs user-scoped data off it. M2 is pure
extraction with proof-of-no-change, making M3 a content exercise — which is
the test that "a lane = a folder." M4 needs M2's briefing/pack seams and makes
the product sticky before more lanes multiply. M5 needs M3's proven pack
system, M4's continuity (programs are continuity), and Mosi's materials.
M6 monetizes only after M4 demonstrates the thing worth paying monthly for.
