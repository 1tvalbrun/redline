# Interview Prep Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth DomainPack, `interview`, whose middle stage is a new Blueprint prep step (role-specific interview plan) instead of the claims Audit, ending in the existing debrief shape plus an optional `verifyItems` list.

**Architecture:** The `DomainPack` contract becomes discriminated on its prep stage (`prep: { kind: "audit" } | { kind: "blueprint" }`); the `/audit` route branches on it. A new Convex pipeline (`convex/blueprints.ts`) mirrors `runAudit`'s claim/idempotency pattern to generate, and once refine, a blueprint stored on the practice document. The interview pack (personas, prompts, briefing) is pure domain content following the sales lane's structure.

**Tech Stack:** Next.js 16.2 (App Router, client components), TypeScript strict, Convex, OpenAI SDK (`resolveModel("fast"|"quality")`), Tailwind v4 utility classes, `node --test` for tests.

**Spec:** `docs/superpowers/specs/2026-08-17-interview-lane-design.md` — read it before starting any task; every task below argues from it.

## Global Constraints

- **NEVER commit, stage, or stash.** CLAUDE.md forbids it: the developer is the only one who commits. Every task ends by running verification and stopping; work stays uncommitted in the tree. Ignore any commit instruction boilerplate — task steps below deliberately contain none.
- No semicolons; const arrow functions only; `handle` prefix on event handlers; early returns; Tailwind utilities only; no TODOs or placeholders.
- Import style: files in `src/lib/` and `src/domains/` import relative with explicit `.ts` extension (`"./audit.ts"`, `"../types.ts"`); files in `src/components/` and `src/app/` use `@/` and `@convex/` aliases without extension; files in `convex/` import `"../src/..."` without extension.
- Tests: `pnpm test` runs `node --test src/lib/*.test.ts src/domains/*.test.ts src/domains/*/*.test.ts`. New test files under those globs run automatically. Node's runner strips types without checking them, so type-level verification is `pnpm build` (Task 10) — do not add a tsc step per task, but keep code type-correct.
- Model tiers: blueprint generation and refinement use `resolveModel("quality")`; everything else keeps its current tier.
- Fixed user-facing failure messages only — provider error text never reaches a client-readable field (mirror `generateAudit`).
- Verdict values must stay **distinct across all packs** (`findVerdict` is first-match-wins). The spec's `advance` value collides with the founder lane's `advance`; this plan uses `move-forward` (label "Would move you forward") instead. Labels/tones follow the spec.
- Spec-completing decisions locked here (do not re-litigate mid-task): blueprint carries a sealed `candidateHooks` array (the spec's briefing §4 needs resume hooks and the blueprint generation step is the only place that sees materials); refinement bookkeeping lives in an optional `refinement` object on the blueprint; the honest-scoping briefing section exists only when `verifyTopics` is non-empty and is ordered **before** resume hooks (the spec's test requirement wins over its prose ordering).

---

### Task 1: Blueprint domain library (`src/lib/blueprint.ts`)

**Files:**
- Create: `src/lib/blueprint.ts`
- Test: `src/lib/blueprint.test.ts`

**Interfaces:**
- Consumes: `v`/`Infer` from `convex/values`; `asString`, `field` from `src/lib/audit.ts`.
- Produces (later tasks rely on these exact names):
  - Validators: `blueprintValidator`, `themeValidator`, `clarifyingQuestionValidator`, `questionPlanEntryValidator`, `rubricEntryValidator`
  - Types: `Blueprint`, `BlueprintTheme`, `ClarifyingQuestion`, `QuestionPlanEntry`, `RubricEntry`, `ParsedBlueprint`
  - Functions: `parseBlueprint(raw: unknown): ParsedBlueprint | null`, `blueprintStatusFor(questions: ClarifyingQuestion[]): "ready" | "awaiting-input"`, `canClaimBlueprint(existing: Blueprint | null, force: boolean): boolean`, `canRequestRefinement(blueprint: Blueprint): boolean`
  - Constants: `MAX_THEMES = 6`, `MAX_CLARIFYING = 3`, `MAX_QUESTIONS_PER_THEME = 4`, `MAX_VERIFY_TOPICS = 6`, `MAX_HOOKS = 4`, `ANSWER_CHARS = 300`, `REDIRECT_NOTE_CHARS = 240`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blueprint.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  blueprintStatusFor,
  canClaimBlueprint,
  canRequestRefinement,
  parseBlueprint,
  type Blueprint,
} from "./blueprint.ts"

const theme = (i: number) => ({ title: `Theme ${i}`, detail: `What theme ${i} probes` })
const planEntry = (i: number) => ({
  theme: `Theme ${i}`,
  questions: [{ question: `Question for theme ${i}`, followUp: "Press for specifics" }],
})

const validRaw = {
  themes: [theme(1), theme(2)],
  clarifyingQuestions: ["Which state are you licensed in?"],
  questionPlan: [planEntry(1), planEntry(2)],
  rubric: [{ theme: "Theme 1", strong: "Concrete and owned", weak: "Vague and borrowed" }],
  verifyTopics: ["Georgia licensing requirements"],
  candidateHooks: ["Led the ICU float pool through the Epic migration"],
}

test("a well-formed blueprint parses with every section", () => {
  const parsed = parseBlueprint(validRaw)
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 2)
  assert.equal(parsed.clarifyingQuestions[0].question, "Which state are you licensed in?")
  assert.equal(parsed.clarifyingQuestions[0].answer, undefined)
  assert.equal(parsed.questionPlan.length, 2)
  assert.equal(parsed.rubric.length, 1)
  assert.deepEqual(parsed.verifyTopics, ["Georgia licensing requirements"])
  assert.equal(parsed.candidateHooks.length, 1)
})

test("caps are enforced: themes 6, clarifying 3, questions per theme 4, hooks 4", () => {
  const raw = {
    themes: Array.from({ length: 9 }, (_, i) => theme(i)),
    clarifyingQuestions: ["a?", "b?", "c?", "d?", "e?"],
    questionPlan: [
      {
        theme: "Theme 0",
        questions: Array.from({ length: 7 }, (_, i) => ({ question: `q${i}`, followUp: "f" })),
      },
    ],
    rubric: [],
    verifyTopics: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"],
    candidateHooks: ["h1", "h2", "h3", "h4", "h5", "h6"],
  }
  const parsed = parseBlueprint(raw)
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 6)
  assert.equal(parsed.clarifyingQuestions.length, 3)
  assert.equal(parsed.questionPlan[0].questions.length, 4)
  assert.equal(parsed.verifyTopics.length, 6)
  assert.equal(parsed.candidateHooks.length, 4)
})

test("plan and rubric entries for unknown themes are dropped", () => {
  const parsed = parseBlueprint({
    ...validRaw,
    questionPlan: [planEntry(1), { theme: "Invented theme", questions: planEntry(1).questions }],
    rubric: [{ theme: "Invented theme", strong: "s", weak: "w" }],
  })
  assert.ok(parsed)
  assert.equal(parsed.questionPlan.length, 1)
  assert.equal(parsed.rubric.length, 0)
})

test("malformed output is rejected, never partially accepted", () => {
  assert.equal(parseBlueprint(null), null)
  assert.equal(parseBlueprint("nonsense"), null)
  assert.equal(parseBlueprint({ themes: [] }), null)
  // Themes without a single planned question cannot run an interview.
  assert.equal(parseBlueprint({ ...validRaw, questionPlan: [] }), null)
  assert.equal(parseBlueprint({ ...validRaw, themes: [{ title: "no detail" }] }), null)
})

test("junk entries inside arrays are skipped, not fatal", () => {
  const parsed = parseBlueprint({
    ...validRaw,
    themes: [theme(1), 42, { title: "", detail: "x" }, theme(2)],
    clarifyingQuestions: [null, "Real question?", 7],
    verifyTopics: [null, "Real topic", { nested: true }],
  })
  assert.ok(parsed)
  assert.equal(parsed.themes.length, 2)
  assert.deepEqual(parsed.clarifyingQuestions, [{ question: "Real question?" }])
  assert.deepEqual(parsed.verifyTopics, ["Real topic"])
})

test("status is awaiting-input only while a clarifying question lacks an answer", () => {
  assert.equal(blueprintStatusFor([]), "ready")
  assert.equal(blueprintStatusFor([{ question: "q?" }]), "awaiting-input")
  assert.equal(blueprintStatusFor([{ question: "q?", answer: "a" }]), "ready")
})

const base: Blueprint = {
  status: "ready",
  themes: [theme(1)],
  clarifyingQuestions: [],
  questionPlan: [planEntry(1)],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
}

test("claims collapse concurrent triggers and respect force, mirroring the audit", () => {
  assert.equal(canClaimBlueprint(null, false), true)
  assert.equal(canClaimBlueprint({ ...base, status: "generating" }, false), false)
  assert.equal(canClaimBlueprint({ ...base, status: "generating" }, true), false)
  assert.equal(canClaimBlueprint({ ...base, status: "failed" }, false), true)
  assert.equal(canClaimBlueprint(base, false), false)
  assert.equal(canClaimBlueprint(base, true), true)
  assert.equal(canClaimBlueprint({ ...base, status: "awaiting-input" }, false), false)
})

test("a pending refinement is claimable without force; a completed one is not", () => {
  const pending = {
    ...base,
    refinement: { removedThemes: [], redirectNote: "less system design", completed: false },
  }
  assert.equal(canClaimBlueprint(pending, false), true)
  const done = { ...pending, refinement: { ...pending.refinement, completed: true } }
  assert.equal(canClaimBlueprint(done, false), false)
})

test("refinement can be requested exactly once", () => {
  assert.equal(canRequestRefinement(base), true)
  assert.equal(canRequestRefinement({ ...base, status: "awaiting-input" }), true)
  assert.equal(canRequestRefinement({ ...base, status: "generating" }), false)
  assert.equal(canRequestRefinement({ ...base, status: "failed" }), false)
  assert.equal(
    canRequestRefinement({
      ...base,
      refinement: { removedThemes: [], redirectNote: "", completed: true },
    }),
    false
  )
  assert.equal(
    canRequestRefinement({
      ...base,
      refinement: { removedThemes: [], redirectNote: "", completed: false },
    }),
    false
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/blueprint.test.ts`
Expected: FAIL — cannot find module `./blueprint.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blueprint.ts`:

```ts
import { v, type Infer } from "convex/values"
import { asString, field } from "./audit.ts"

// Single source for the blueprint contract: the schema field, the Convex
// mutations, and the TS types all derive from these validators — same
// discipline as src/lib/audit.ts.

export const themeValidator = v.object({ title: v.string(), detail: v.string() })
export const clarifyingQuestionValidator = v.object({
  question: v.string(),
  // Written by blueprints.requestRefinement, clamped like all scope text.
  answer: v.optional(v.string()),
})
export const questionPlanEntryValidator = v.object({
  theme: v.string(),
  questions: v.array(v.object({ question: v.string(), followUp: v.string() })),
})
export const rubricEntryValidator = v.object({
  theme: v.string(),
  strong: v.string(),
  weak: v.string(),
})

export const blueprintValidator = v.object({
  status: v.union(
    v.literal("generating"),
    v.literal("awaiting-input"),
    v.literal("ready"),
    v.literal("failed")
  ),
  themes: v.array(themeValidator),
  clarifyingQuestions: v.array(clarifyingQuestionValidator),
  // Sealed: stored server-side, never rendered by the client. A user reading
  // the network response only spoils their own practice — accepted.
  questionPlan: v.array(questionPlanEntryValidator),
  rubric: v.array(rubricEntryValidator),
  verifyTopics: v.array(v.string()),
  candidateHooks: v.array(v.string()),
  // The one refinement pass: written when the user submits answers, removals,
  // or a redirect note; completed flips when the pass lands. Its presence —
  // completed or not — closes further refinement requests.
  refinement: v.optional(
    v.object({
      removedThemes: v.array(v.string()),
      redirectNote: v.string(),
      completed: v.boolean(),
    })
  ),
  failureMessage: v.optional(v.string()),
})

export type Blueprint = Infer<typeof blueprintValidator>
export type BlueprintTheme = Infer<typeof themeValidator>
export type ClarifyingQuestion = Infer<typeof clarifyingQuestionValidator>
export type QuestionPlanEntry = Infer<typeof questionPlanEntryValidator>
export type RubricEntry = Infer<typeof rubricEntryValidator>

export const MAX_THEMES = 6
export const MAX_CLARIFYING = 3
export const MAX_QUESTIONS_PER_THEME = 4
export const MAX_VERIFY_TOPICS = 6
export const MAX_HOOKS = 4
export const ANSWER_CHARS = 300
export const REDIRECT_NOTE_CHARS = 240

const THEME_TITLE_CHARS = 60
const THEME_DETAIL_CHARS = 200
const QUESTION_CHARS = 240
const FOLLOW_UP_CHARS = 200
const CLARIFYING_CHARS = 160
const RUBRIC_CHARS = 300
const VERIFY_TOPIC_CHARS = 120
const HOOK_CHARS = 160

export type ParsedBlueprint = {
  themes: BlueprintTheme[]
  clarifyingQuestions: ClarifyingQuestion[]
  questionPlan: QuestionPlanEntry[]
  rubric: RubricEntry[]
  verifyTopics: string[]
  candidateHooks: string[]
}

const stringList = (raw: unknown, max: number, chars: number): string[] =>
  (Array.isArray(raw) ? raw : [])
    .flatMap((entry) => {
      const text = asString(entry)
      return text ? [text.slice(0, chars)] : []
    })
    .slice(0, max)

// Validates and bounds model output. Anything without the minimum viable
// plan — at least one theme with at least one planned question — is
// rejected wholesale to null; the caller stores a failed status with a
// fixed message, never a half-blueprint.
export const parseBlueprint = (raw: unknown): ParsedBlueprint | null => {
  const themesRaw = field(raw, "themes")
  if (!Array.isArray(themesRaw)) return null
  const themes = themesRaw
    .flatMap((entry) => {
      const title = asString(field(entry, "title"))
      const detail = asString(field(entry, "detail"))
      if (!title || !detail) return []
      return [{ title: title.slice(0, THEME_TITLE_CHARS), detail: detail.slice(0, THEME_DETAIL_CHARS) }]
    })
    .slice(0, MAX_THEMES)
  if (themes.length === 0) return null
  const themeTitles = new Set(themes.map((entry) => entry.title))

  const planRaw = field(raw, "questionPlan")
  const questionPlan = (Array.isArray(planRaw) ? planRaw : []).flatMap((entry) => {
    const theme = asString(field(entry, "theme"))?.slice(0, THEME_TITLE_CHARS)
    if (!theme || !themeTitles.has(theme)) return []
    const questionsRaw = field(entry, "questions")
    const questions = (Array.isArray(questionsRaw) ? questionsRaw : [])
      .flatMap((questionEntry) => {
        const question = asString(field(questionEntry, "question"))
        if (!question) return []
        const followUp = asString(field(questionEntry, "followUp")) ?? ""
        return [
          {
            question: question.slice(0, QUESTION_CHARS),
            followUp: followUp.slice(0, FOLLOW_UP_CHARS),
          },
        ]
      })
      .slice(0, MAX_QUESTIONS_PER_THEME)
    return questions.length > 0 ? [{ theme, questions }] : []
  })
  if (questionPlan.length === 0) return null

  const rubricRaw = field(raw, "rubric")
  const rubric = (Array.isArray(rubricRaw) ? rubricRaw : []).flatMap((entry) => {
    const theme = asString(field(entry, "theme"))?.slice(0, THEME_TITLE_CHARS)
    const strong = asString(field(entry, "strong"))
    const weak = asString(field(entry, "weak"))
    if (!theme || !themeTitles.has(theme) || !strong || !weak) return []
    return [{ theme, strong: strong.slice(0, RUBRIC_CHARS), weak: weak.slice(0, RUBRIC_CHARS) }]
  })

  return {
    themes,
    clarifyingQuestions: stringList(
      field(raw, "clarifyingQuestions"),
      MAX_CLARIFYING,
      CLARIFYING_CHARS
    ).map((question) => ({ question })),
    questionPlan,
    rubric,
    verifyTopics: stringList(field(raw, "verifyTopics"), MAX_VERIFY_TOPICS, VERIFY_TOPIC_CHARS),
    candidateHooks: stringList(field(raw, "candidateHooks"), MAX_HOOKS, HOOK_CHARS),
  }
}

export const blueprintStatusFor = (
  questions: ClarifyingQuestion[]
): "ready" | "awaiting-input" =>
  questions.some((question) => !question.answer) ? "awaiting-input" : "ready"

// Same collapse rules as practices.claimAudit, plus one extra door: a
// requested-but-incomplete refinement pass may always claim (that's how the
// scheduled refine run gets in, and how a failed refine retries).
export const canClaimBlueprint = (existing: Blueprint | null, force: boolean): boolean => {
  if (!existing) return true
  if (existing.status === "generating") return false
  if (existing.refinement && !existing.refinement.completed) return true
  if (existing.status === "failed") return true
  return force
}

// Exactly one refinement pass per blueprint: any refinement record —
// pending or completed — closes the door.
export const canRequestRefinement = (blueprint: Blueprint): boolean =>
  (blueprint.status === "ready" || blueprint.status === "awaiting-input") &&
  blueprint.refinement === undefined
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/lib/blueprint.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite to confirm nothing broke**

Run: `pnpm test`
Expected: PASS. Stop for review.

---

### Task 2: Discriminated prep contract and engine touchpoints

**Files:**
- Modify: `src/domains/types.ts` (prep discrimination, new input types, optional pack hooks)
- Modify: `src/domains/founder/pack.ts`, `src/domains/sales/pack.ts`, `src/domains/audit/pack.ts` (move audit prompt + audit stage copy into the `prep` arm)
- Modify: `convex/practices.ts` (prep-kind guard + `prepKind` internal query, `pack.prep.prompt`)
- Modify: `src/components/simulation/flow/FlowShell.tsx` (pack-supplied middle-beat label)
- Modify: `src/app/(flow)/simulation/new/page.tsx` (pass `packId` to FlowShell)
- Modify: `src/components/simulation/intake/AuditStage.tsx` (read copy from `pack.prep`)
- Modify: `src/components/simulation/intake/PanelSetup.tsx` (pack `recommendPersona` hook, `sessionMetaField`)
- Modify: `src/app/(flow)/simulation/[id]/room/page.tsx` (`sessionMetaField`)
- Test: `src/domains/registry.test.ts` (create)

**Interfaces:**
- Consumes: `Blueprint` from `src/lib/blueprint.ts` (Task 1).
- Produces (exact shapes later tasks build against):

```ts
// in src/domains/types.ts
export type BlueprintPromptInput = {
  scope: Scope
  unreadableCount: number
  materialSections: string
}
export type BlueprintRefineInput = {
  scope: Scope
  blueprint: Blueprint
  removedThemes: string[]
  redirectNote: string
}
export type PrepStageCopy = {
  kicker: string
  readyHeading: string
  readyLead: string
  cta: string
}
export type AuditPrep = {
  kind: "audit"
  stepLabel: string
  prompt: (input: AuditPromptInput) => string
  wait: StageWaitCopy
  copy: PrepStageCopy & { zeroClaims: string }
}
export type BlueprintPrep = {
  kind: "blueprint"
  stepLabel: string
  prompt: (input: BlueprintPromptInput) => string
  refine: (input: BlueprintRefineInput) => string
  wait: StageWaitCopy
  copy: PrepStageCopy
}
```
  plus on `DomainPack`: `prep: AuditPrep | BlueprintPrep`, optional `sessionMetaField?: string`, optional `recommendPersona?: (scope: Scope) => { personaId: string; reason: string } | null`; `BriefingInput` gains `blueprint?: Blueprint | null`; `OrchestratePromptInput` gains `themes?: string[] | null`; `DebriefPromptInput` gains `blueprint?: { rubric: { theme: string; strong: string; weak: string }[]; verifyTopics: string[] } | null`; `PackCopy` **loses** `audit` and `auditWait`; `DomainPack.prompts` **loses** `audit`.
- Also produces: `internal.practices.prepKind` (internalQuery, `{ id: Id<"practices"> } → "audit" | "blueprint" | null`).

- [ ] **Step 1: Write the failing registry test**

Create `src/domains/registry.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { ALL_PACKS, PACKS } from "./registry.ts"

// Type-level coverage rides along: this file only compiles/runs if every
// pack satisfies the discriminated prep contract.
test("every lane declares its prep stage", () => {
  assert.equal(PACKS.founder.prep.kind, "audit")
  assert.equal(PACKS.sales.prep.kind, "audit")
  assert.equal(PACKS.audit.prep.kind, "audit")
  for (const pack of ALL_PACKS) {
    assert.ok(pack.prep.stepLabel.length > 0)
  }
})

test("verdict values stay distinct across packs (findVerdict is first-match-wins)", () => {
  const values = ALL_PACKS.flatMap((pack) => pack.verdicts.options.map((option) => option.value))
  assert.equal(new Set(values).size, values.length)
})
```

Run: `node --test src/domains/registry.test.ts`
Expected: FAIL — `prep` does not exist on the packs yet.

- [ ] **Step 2: Rewrite the contract in `src/domains/types.ts`**

At the top, add the import:

```ts
import type { Blueprint } from "../lib/blueprint.ts"
```

Add `blueprint` to `BriefingInput` (after `audit`):

```ts
export type BriefingInput = {
  scope: Scope
  audit: { claims: Claim[]; gaps: Gap[] } | null
  // The interview lane's prep artifact; other lanes never receive one.
  blueprint?: Blueprint | null
  continuity: Continuity | null
  transcript: { text: string; type: "user" | "panelist"; timestamp: number; spokenAt?: number }[]
}
```

Extend `OrchestratePromptInput`:

```ts
export type OrchestratePromptInput = {
  characterName: string
  characterRole: string
  characterTone: string
  scope: Scope
  // Blueprint theme titles, for lanes that track prepared-theme coverage.
  themes?: string[] | null
}
```

Extend `DebriefPromptInput` (add after `continuity`):

```ts
  // The prep blueprint's sealed rubric and verify topics, so feedback traces
  // to pre-declared criteria. Null for lanes without a blueprint.
  blueprint?: {
    rubric: { theme: string; strong: string; weak: string }[]
    verifyTopics: string[]
  } | null
```

After `StageWaitCopy`, add the prep types exactly as listed in **Interfaces** above (`BlueprintPromptInput`, `BlueprintRefineInput`, `PrepStageCopy`, `AuditPrep`, `BlueprintPrep`).

In `PackCopy`, **delete** the `auditWait` and `audit` members (they move into the prep arm).

In `DomainPack`:
- after `evidenceRequests`, add:

```ts
  // The middle stage between the read and the panel, discriminated so an
  // interview pack cannot carry a dangling audit prompt and an audit pack
  // cannot omit one. stepLabel names the beat in the flow rail.
  prep: AuditPrep | BlueprintPrep
  // Scope key whose value labels the session in the room header and panel
  // card ("Session 4 · CourtTime · Data recovery"). Absent means the lane
  // has no per-session focus; the shortLabel shows instead.
  sessionMetaField?: string
  // Pack-supplied persona recommendation, consulted after "you faced them
  // last time" and before the generic focusAreas heuristic. Null means no
  // opinion.
  recommendPersona?: (scope: Scope) => { personaId: string; reason: string } | null
```

- in `prompts`, **delete** the `audit` member.

- [ ] **Step 3: Move the audit prompt and stage copy into each pack's `prep` arm**

In each of `src/domains/founder/pack.ts`, `src/domains/sales/pack.ts`, `src/domains/audit/pack.ts`, make the same mechanical move (shown for sales; founder and audit are identical in shape):

1. In the `copy:` object, cut the entire `auditWait: { ... }` and `audit: { ... }` blocks.
2. After the `evidenceRequests` field (audit pack) / after `verdicts` (founder, sales), insert:

```ts
  prep: {
    kind: "audit",
    stepLabel: "Pre-read",
    prompt: audit,
    wait: {
      // ← the exact object that was copy.auditWait, unchanged
    },
    copy: {
      // ← the exact object that was copy.audit, unchanged
    },
  },
```

3. In the final `prompts:` object, remove `audit`: `prompts: { analyzeSystem, analyzeUser, orchestrate, debrief, extractScope }`.
4. For the audit pack only, also set `sessionMetaField: "controlArea"` immediately after `prep` (this preserves today's hardcoded room-header behavior; founder and sales get no `sessionMetaField`).

- [ ] **Step 4: Update the engine consumers of the moved prompt/copy**

`convex/practices.ts`:
- In `generateAudit`, before the `claimAudit` call, add a lane guard (a blueprint-pack practice must never grow an `audit` field — the claim itself would write one):

```ts
  const kind = await ctx.runQuery(internal.practices.prepKind, { id: args.id })
  if (kind !== "audit") return
```

- Change the prompt call inside `generateAudit`: the audit prompt now lives on the prep arm, and TypeScript needs the narrow:

```ts
    const pack = getPack(practice.packId)
    if (pack.prep.kind !== "audit") {
      await fail("This practice doesn't use the audit stage.")
      return
    }
    const auditPrompt = pack.prep.prompt
```

  and use `auditPrompt({ scope: practice.scope, unreadableCount, materialSections })` as the system message content in place of `pack.prompts.audit(...)`.
- Add the internal query (near `auditInputs`):

```ts
// Which prep stage this practice's lane runs — lets the scheduler and the
// audit pipeline stay off blueprint-lane practices (and vice versa).
export const prepKind = internalQuery({
  args: { id: v.id("practices") },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    return practice ? getPack(practice.packId).prep.kind : null
  },
})
```

`src/components/simulation/intake/AuditStage.tsx`:
- After `const pack = getPack(practice.packId)`, replace `const copy = pack.copy.audit` with:

```ts
  const prep = pack.prep
  if (prep.kind !== "audit") return null
  const copy = prep.copy
```

- Replace every `pack.copy.auditWait` read (the `WaitingScreen` props block) with `prep.wait` (e.g. `kicker={prep.wait.kicker}`, `heading={prep.wait.heading(...)}` etc.).

- [ ] **Step 5: Pack-supplied middle-beat label in FlowShell**

In `src/components/simulation/flow/FlowShell.tsx`:
- Add imports:

```ts
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
```

- Add `packId?: string` to `FlowShellProps` (documented: "Names the lane before a practice exists — the brief stage's wizard knows the lane, the later stages resolve it from the practice.").
- Delete the module-level `DISPLAY_STEPS` constant. Inside the component, before `currentIndex`:

```ts
  // The middle beat's name comes from the lane ("Pre-read" for audit lanes,
  // the blueprint label for the interview lane). Resolved from the packId
  // prop when the caller knows it, else from the practice; the default
  // covers the frame before either loads.
  const practice = useQuery(
    api.practices.get,
    packId || !simulationId ? "skip" : { id: simulationId as Id<"practices"> }
  )
  const pack = packId ? getPack(packId) : practice ? getPack(practice.packId) : null
  const displaySteps: { label: string; keys: FlowStage[] }[] = [
    { label: "Brief", keys: ["brief"] },
    { label: pack?.prep.stepLabel ?? "Pre-read", keys: ["read", "audit"] },
    { label: "Panel", keys: ["panel"] },
    { label: "Room", keys: ["room"] },
  ]
  const currentIndex = displaySteps.findIndex((step) => step.keys.includes(stage))
```

- Replace both `DISPLAY_STEPS` usages in the JSX with `displaySteps` (the `.map` and the `.length - 1` divider check). Destructure `packId` in the component parameters.

In `src/app/(flow)/simulation/new/page.tsx`, change `<FlowShell stage="brief" fullBleed>` to `<FlowShell stage="brief" packId={pack.id} fullBleed>`.

- [ ] **Step 6: `sessionMetaField` and `recommendPersona` hooks**

`src/app/(flow)/simulation/[id]/room/page.tsx` — replace the `focus` computation:

```ts
  const pack = practice ? getPack(practice.packId) : null
  const focus =
    practice && pack
      ? (pack.sessionMetaField ? scopeText(practice.scope, pack.sessionMetaField) : "") ||
        pack.shortLabel
      : null
```

`src/components/simulation/intake/PanelSetup.tsx`:
- In `recommendPersona`, insert the pack hook between the previous-persona check and the focus heuristic:

```ts
  const packPick = pack.recommendPersona?.(scope) ?? null
  if (packPick) {
    const persona = pack.personas.find((p) => p.id === packPick.personaId)
    if (persona) return { persona, reason: packPick.reason }
  }
```

- Replace the hardcoded `controlArea` read in the single-persona card (around line 239):

```tsx
                {pack.sessionMetaField &&
                  scopeText(practice.scope, pack.sessionMetaField) &&
                  ` · ${scopeText(practice.scope, pack.sessionMetaField)}`}
```

- [ ] **Step 7: Run the tests**

Run: `node --test src/domains/registry.test.ts` — Expected: PASS.
Run: `pnpm test` — Expected: PASS (founder/sales/audit prompt pin tests import the prompt functions directly, not through the pack, so they are unaffected; if any test read `pack.prompts.audit` or `pack.copy.audit`, update it to `pack.prep`).
Run: `pnpm lint` — Expected: clean. Stop for review.

---

### Task 3: Debrief `verifyItems`

**Files:**
- Modify: `src/lib/debrief.ts`
- Modify: `convex/schema.ts` (`debriefValidator`)
- Modify: `convex/sessions.ts` (`generateDebrief` write)
- Modify: `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` (render section)
- Test: `src/lib/debrief.test.ts` (extend)

**Interfaces:**
- Consumes: existing `parseDebrief` contract.
- Produces: `DebriefContent.verifyItems: { text: string }[]` (always present, possibly empty); schema `debriefValidator.verifyItems` optional (existing debriefs without it stay valid — no migration).

- [ ] **Step 1: Write the failing tests**

Open `src/lib/debrief.test.ts`, note the existing `options` fixture pattern (a `ParseDebriefOptions` with verdict values and `userTurns`), and append, reusing whatever base fixture the file already defines (if it defines a helper like `const options = {...}`, use it; the literals below show the required semantics):

```ts
test("verifyItems are accepted, capped at 4, and clamped", () => {
  const parsed = parseDebrief(
    {
      verdict: { decision: "second-meeting", summary: "s" },
      verifyItems: [
        { text: "Confirm Georgia licensing requirements with the state board" },
        { text: "x".repeat(400) },
        { text: "third" },
        { text: "fourth" },
        { text: "fifth never survives the cap" },
        "junk entry",
      ],
    },
    {
      verdictValues: ["buy", "second-meeting", "walk"],
      fallbackVerdict: "second-meeting",
      lowestVerdict: "walk",
      userTurns: ["enough words to clear the participation floor ".repeat(3)],
    }
  )
  assert.equal(parsed.verifyItems.length, 4)
  assert.equal(
    parsed.verifyItems[0].text,
    "Confirm Georgia licensing requirements with the state board"
  )
  assert.equal(parsed.verifyItems[1].text.length, 200)
})

test("a debrief without verifyItems parses to an empty list", () => {
  const parsed = parseDebrief(
    { verdict: { decision: "walk", summary: "s" } },
    {
      verdictValues: ["buy", "second-meeting", "walk"],
      fallbackVerdict: "second-meeting",
      lowestVerdict: "walk",
      userTurns: ["enough words to clear the participation floor ".repeat(3)],
    }
  )
  assert.deepEqual(parsed.verifyItems, [])
})
```

Run: `node --test src/lib/debrief.test.ts`
Expected: FAIL — `verifyItems` is not on `DebriefContent`.

- [ ] **Step 2: Implement in `src/lib/debrief.ts`**

- Add to `DebriefContent` after `didntHold`:

```ts
  // "Verify with an official source" items — the interviewer couldn't vouch
  // for a regulated fact. Distinct from didntHold (a weak answer).
  verifyItems: { text: string }[]
```

- Add constants near the others: `const VERIFY_CHARS = 200` and `const MAX_VERIFY_ITEMS = 4`.
- In `parseDebrief`, after the `didntHold` block:

```ts
  const verifyRaw = field(raw, "verifyItems")
  const verifyItems = (Array.isArray(verifyRaw) ? verifyRaw : [])
    .slice(0, MAX_VERIFY_ITEMS)
    .flatMap((entry) => {
      const text = asString(field(entry, "text"))
      return text ? [{ text: clamp(text, VERIFY_CHARS) }] : []
    })
```

- Add `verifyItems,` to the returned object (after `didntHold`).

- [ ] **Step 3: Run the tests to verify they pass**

Run: `node --test src/lib/debrief.test.ts`
Expected: PASS.

- [ ] **Step 4: Store and render it**

`convex/schema.ts` — in `debriefValidator`, after `didntHold`:

```ts
  // Present only when the session touched regulated territory the
  // interviewer could not vouch for. Optional: existing debriefs without
  // the field remain valid — no migration.
  verifyItems: v.optional(v.array(v.object({ text: v.string() }))),
```

`convex/sessions.ts` — in `generateDebrief`, inside the `setDebrief` call's `debrief` object, after `didntHold: parsed.didntHold,`:

```ts
        ...(parsed.verifyItems.length > 0 ? { verifyItems: parsed.verifyItems } : {}),
```

`src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` — in the "Under pressure" aside, immediately after the closing of the `didntHold` conditional block (after its `</>` and `)}`), add:

```tsx
              {(debrief.verifyItems ?? []).length > 0 && (
                <>
                  <div className="mb-1.5 mt-5 flex items-center gap-2">
                    <span className="grid h-[17px] w-[17px] place-items-center rounded-[5px] bg-accent-bg text-[10px] font-bold text-accent-blue">
                      !
                    </span>
                    <p className="text-xs font-semibold tracking-[.02em]">
                      Verify before the real thing
                    </p>
                  </div>
                  <p className="mb-1 text-xs leading-normal text-on-surface-3">
                    Not weak answers — facts your interviewer couldn&apos;t vouch for. Check
                    them with an official source.
                  </p>
                  {(debrief.verifyItems ?? []).map((item, i) => (
                    <div key={i} className="border-t border-line py-2.5 first:border-t-0">
                      <p className="text-[13px] leading-normal text-on-surface-2">{item.text}</p>
                    </div>
                  ))}
                </>
              )}
```

- [ ] **Step 5: Verify**

Run: `pnpm test` — Expected: PASS.
Run: `npx convex codegen` — regenerates `convex/_generated` types for the schema change. Expected: no errors.
Run: `pnpm lint` — Expected: clean. Stop for review.

---

### Task 4: Interview cast (personas + portraits)

**Files:**
- Create: `src/domains/interview/personas.ts`
- Rename: `public/avatars/tomás-reyes.png` → `public/avatars/tomas-reyes.png` (non-ASCII public asset paths break URL handling on some CDNs; `jun-park.png` and `renee-calloway.png` stay as-is)

**Interfaces:**
- Produces: `INTERVIEWER_PERSONAS: Persona[]` with ids `screener-01`, `hm-01`, `practitioner-01` (Task 7's pack and the spec's `avatars:register` commands depend on these exact ids).

- [ ] **Step 1: Rename the portrait**

Run: `mv "public/avatars/tomás-reyes.png" public/avatars/tomas-reyes.png`
Expected: `ls public/avatars/` shows `jun-park.png`, `renee-calloway.png`, `tomas-reyes.png`.

- [ ] **Step 2: Write the personas**

Create `src/domains/interview/personas.ts`:

```ts
import type { Persona } from "../types.ts"

// The interview lane's cast of three, specialized by interview format, not
// domain — formats are few and stable; domains are infinite. The spoken
// personalities live on the Runway Characters (domain-blind, with a
// permanent honest-scoping backstop); these fields feed persona cards and
// the debrief prompts. Runway avatar ids live in the Convex avatars
// registry (npx convex run avatars:register — see the spec).
export const INTERVIEWER_PERSONAS: Persona[] = [
  {
    id: "screener-01",
    archetypeId: "recruiter_screen",
    name: "Jun Park",
    role: "Recruiter, first-round screen",
    shortRole: "The screener",
    tone: "Fast, warm, efficient; listens for motivation, a coherent career story, and the fit questions a resume can't answer",
    image: "/avatars/jun-park.png",
    attack: [
      { text: "Runs the thirty-minute screen. Comes for " },
      { text: "your story and your why", strong: true },
      { text: ": what you did, why you're leaving, and whether it holds together at pace." },
    ],
    bio: "Screens hundreds of candidates a year and decides in minutes who moves forward. Friendly on the surface, ruthless about vagueness — a rambling answer is its own red flag.",
    tags: ["Motivation", "Career story", "Fit"],
    signature:
      "Walk me through the last few years in about a minute — and what you're looking for next.",
  },
  {
    id: "hm-01",
    archetypeId: "hiring_manager",
    name: "Renee Calloway",
    role: "Hiring manager, behavioral loop",
    shortRole: "The hiring manager",
    tone: "Steady and probing, goes three levels deep on every story; allergic to a 'we' that hides what you actually did",
    image: "/avatars/renee-calloway.png",
    attack: [
      { text: "Owns the team you'd join. Comes for " },
      { text: "ownership and conflict", strong: true },
      { text: ": real stories, your actual role in them, and what you'd do differently." },
    ],
    bio: "Has hired and managed through enough cycles to know rehearsed answers on sight. Asks for one story, then follows it down until the real decisions and the real mistakes show.",
    tags: ["Ownership", "Conflict", "Behavioral depth"],
    signature: "Tell me about a time this went wrong — and what you did about it.",
  },
  {
    id: "practitioner-01",
    archetypeId: "domain_practitioner",
    name: "Tomás Reyes",
    role: "Senior practitioner, domain deep-dive",
    shortRole: "The practitioner",
    tone: "Knowledgeable and scenario-driven; presses why-chains and trade-offs until the reasoning either holds or runs out",
    image: "/avatars/tomas-reyes.png",
    attack: [
      { text: "Does the job you're interviewing for. Comes for " },
      { text: "scenarios and trade-offs", strong: true },
      { text: ": concrete situations, your reasoning under pressure, and the why behind each call." },
    ],
    bio: "The panelist who's done the work. Doesn't quiz on trivia — puts you in a situation from the role and keeps asking why until it's clear whether you've actually been there.",
    tags: ["Technical depth", "Trade-offs", "Scenarios"],
    signature: "Let's get concrete. Walk me through exactly how you'd handle this one.",
  },
]
```

- [ ] **Step 3: Verify**

Run: `pnpm test` — Expected: PASS (nothing imports the file yet; this confirms no syntax damage).
Stop for review.

---

### Task 5: Interview prompts

**Files:**
- Create: `src/domains/interview/prompts.ts`
- Test: `src/domains/interview/prompts.test.ts`

**Interfaces:**
- Consumes: `Scope`, `scopeText`, `scopeList`, `BlueprintPromptInput`, `BlueprintRefineInput`, `OrchestratePromptInput`, `DebriefPromptInput` from `../types.ts` (Task 2 shapes).
- Produces (Task 7 assembles these): `analyzeSystem: string`, `analyzeUser(scope)`, `extractScope({source, pitch})`, `blueprint(input: BlueprintPromptInput)`, `refineBlueprint(input: BlueprintRefineInput)`, `orchestrate(input)`, `debrief(input)`.
- Verdict vocabulary in the debrief prompt: `"move-forward" | "on-the-fence" | "not-yet"` (see Global Constraints — NOT the spec's `advance`).

- [ ] **Step 1: Write the failing pin tests**

Create `src/domains/interview/prompts.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  analyzeSystem,
  blueprint,
  debrief,
  extractScope,
  orchestrate,
  refineBlueprint,
} from "./prompts.ts"
import type { Blueprint } from "../../lib/blueprint.ts"

const scope = {
  roleTitle: "Engineering Manager, frontend teams",
  interviewType: "Behavioral",
  seniority: "Senior",
  industryContext: "state-licensed health insurance sales in Georgia",
  focusAreas: ["Ownership", "Conflict"],
  jobPosting: "We are hiring an EM to lead two squads.",
}

const madeBlueprint: Blueprint = {
  status: "ready",
  themes: [{ title: "Team conflict", detail: "How they handle disagreement" }],
  clarifyingQuestions: [{ question: "IC or manager track?", answer: "Manager" }],
  questionPlan: [
    {
      theme: "Team conflict",
      questions: [{ question: "Tell me about a real conflict", followUp: "What did YOU do" }],
    },
  ],
  rubric: [{ theme: "Team conflict", strong: "Names their own role", weak: "Blames the team" }],
  verifyTopics: ["Georgia licensing requirements"],
  candidateHooks: ["Led the platform migration"],
}

test("the blueprint prompt carries the honest-scoping backstop and the JSON contract", () => {
  const prompt = blueprint({ scope, unreadableCount: 0, materialSections: "(none)" })
  assert.match(prompt, /never state statutes, state rules, licensing requirements, or exam content as fact/i)
  assert.match(prompt, /"themes"/)
  assert.match(prompt, /"clarifyingQuestions"/)
  assert.match(prompt, /"questionPlan"/)
  assert.match(prompt, /"rubric"/)
  assert.match(prompt, /"verifyTopics"/)
  assert.match(prompt, /"candidateHooks"/)
  assert.match(prompt, /zero is the normal answer/i)
  assert.match(prompt, /Engineering Manager, frontend teams/)
})

test("the refine prompt closes the question loop and honors removals", () => {
  const prompt = refineBlueprint({
    scope,
    blueprint: madeBlueprint,
    removedThemes: ["Team conflict"],
    redirectNote: "less system design, more people management",
  })
  assert.match(prompt, /"clarifyingQuestions":\s?\[\]/)
  assert.match(prompt, /there is no second round of questions/i)
  assert.match(prompt, /do not bring these back/i)
  assert.match(prompt, /less system design, more people management/)
  assert.match(prompt, /IC or manager track\?.*Manager/s)
  assert.match(prompt, /never state statutes, state rules, licensing requirements, or exam content as fact/i)
})

test("the orchestrator tracks prepared themes and keeps the calibration contract", () => {
  const prompt = orchestrate({
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    scope,
    themes: ["Team conflict", "Ownership"],
  })
  assert.match(prompt, /Team conflict/)
  assert.match(prompt, /Only when their own words demonstrably earn it/)
  assert.match(prompt, /"note"/)
})

test("the orchestrator stays silent about themes when there is no blueprint", () => {
  const prompt = orchestrate({
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    scope,
    themes: null,
  })
  assert.doesNotMatch(prompt, /prepared interview themes/i)
})

test("the debrief prompt enforces the verdict vocabulary, rubric, and verifyItems contract", () => {
  const prompt = debrief({
    scope,
    characterName: "Renee Calloway",
    characterRole: "Hiring manager",
    characterTone: "Steady and probing",
    notes: "(none)",
    transcript: "CANDIDATE: hello",
    continuity: null,
    blueprint: { rubric: madeBlueprint.rubric, verifyTopics: madeBlueprint.verifyTopics },
  })
  assert.match(prompt, /"move-forward" \| "on-the-fence" \| "not-yet"/)
  assert.match(prompt, /"verifyItems"/)
  assert.match(prompt, /Names their own role/)
  assert.match(prompt, /Georgia licensing requirements/)
  assert.match(prompt, /Torn between two tiers\? Choose the lower/)
  assert.match(prompt, /never repeat or rephrase a commitment already tracked/)
})

test("the debrief prompt stands without a blueprint", () => {
  const prompt = debrief({
    scope,
    characterName: "Jun Park",
    characterRole: "Recruiter",
    characterTone: "Fast",
    notes: "(none)",
    transcript: "CANDIDATE: hello",
    continuity: null,
    blueprint: null,
  })
  assert.doesNotMatch(prompt, /pre-declared rubric/i)
  assert.match(prompt, /"move-forward" \| "on-the-fence" \| "not-yet"/)
})

test("extraction is honest and never invents a job posting from speech", () => {
  const prompt = extractScope({ source: "voice", pitch: "I want to practice for a nursing interview" })
  assert.match(prompt, /extract ONLY what the candidate actually said/i)
  assert.match(prompt, /"jobPosting": always null/)
  assert.match(prompt, /"Screening call" \| "Behavioral" \| "Technical & scenarios" \| "Full loop \(mixed\)"/)
  assert.match(prompt, /nursing interview/)
})

test("analysis extracts only the declared context fields", () => {
  assert.match(analyzeSystem, /roleSummary, interviewShape, pressureAreas, riskiestGap, openQuestions/)
  assert.match(analyzeSystem, /ONLY on what the candidate provided/)
})
```

Run: `node --test src/domains/interview/prompts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Write the prompts**

Create `src/domains/interview/prompts.ts`:

```ts
import {
  scopeList,
  scopeText,
  type BlueprintPromptInput,
  type BlueprintRefineInput,
  type DebriefPromptInput,
  type OrchestratePromptInput,
  type Scope,
} from "../types.ts"

// The interview lane's OpenAI prompts. Same JSON discipline as the other
// lanes; the substance is interview preparation, and every prompt that can
// touch regulated territory carries the honest-scoping backstop. Pin tests
// in prompts.test.ts hold the load-bearing lines in place.

const HONEST_SCOPING = `HONEST SCOPING (absolute): never state statutes, state rules, licensing requirements, or exam content as fact anywhere in your output, even if the candidate does. In regulated or licensed territory, probe how the candidate reasons and how they would verify with official sources; never quiz against a "correct" regulatory answer you supply.`

const scopeBlock = (scope: Scope) =>
  `- Role: ${scopeText(scope, "roleTitle")}
- Interview type: ${scopeText(scope, "interviewType") || "Full loop (mixed)"}
- Seniority: ${scopeText(scope, "seniority") || "(not stated)"}
- Industry context: ${scopeText(scope, "industryContext") || "(not stated)"}
- Where they want the pressure: ${scopeList(scope, "focusAreas").join(", ") || "(not stated)"}`

const jobPostingBlock = (scope: Scope) => {
  const posting = scopeText(scope, "jobPosting")
  return posting ? `\nThe job posting they pasted:\n${posting}\n` : ""
}

export const analyzeSystem = `You are an interview coach. Extract structured context from a candidate's practice-interview scope. Return JSON only with these fields: roleSummary, interviewShape, pressureAreas, riskiestGap, openQuestions. Each field is a string. Base every field ONLY on what the candidate provided — where they gave nothing, say plainly what is missing rather than inventing content.`

export const analyzeUser = (scope: Scope) =>
  `${scopeBlock(scope)}${jobPostingBlock(scope)}`

export const extractScope = ({ source, pitch }: { source: "voice" | "deck"; pitch: string }) =>
  `You turn a candidate's ${source === "voice" ? "spoken description" : "pasted text"} into a structured practice-interview scope. This is extraction only, from what the candidate actually said.

THE HONESTY RULE: extract ONLY what the candidate actually said. If a field is not clearly present, return null for it. A thin or vague description should produce mostly nulls. Never infer, never fill in plausible content, never polish vagueness into specifics. A missing answer is valuable information, not a gap for you to close.

Fields:
- "roleTitle": the role they want to practice interviewing for, in their own terms, only if stated.
- "interviewType": exactly one of "Screening call" | "Behavioral" | "Technical & scenarios" | "Full loop (mixed)", copied verbatim, only if the candidate said what kind of interview they're preparing for.
- "seniority": exactly one of "Entry" | "Mid" | "Senior" | "Leadership", copied verbatim, only if stated or unambiguous from their words.
- "industryContext": the company, industry, or regulatory context in their own terms (e.g. "regional hospital ICU"), only if stated.
- "focusAreas": an array drawn from "Motivation & fit" | "Career story" | "Behavioral stories" | "Ownership" | "Conflict" | "Technical depth" | "Scenario judgment" | "Communication", each copied verbatim, only where the candidate named where they want the pressure. null if they named none.
- "jobPosting": always null — a job posting is pasted, never spoken.

Every value is a string except "focusAreas", which is an array of strings. A chip field that does not match a listed label verbatim is null. Never use an em dash in any output value.

Return JSON only, keyed exactly: {"roleTitle","interviewType","seniority","industryContext","focusAreas","jobPosting"} with null for anything not said.

What they said:
${pitch.slice(0, 12_000)}`

export const blueprint = ({ scope, unreadableCount, materialSections }: BlueprintPromptInput) =>
  `You are the interview panel's preparer, building a role-specific interview blueprint before a live practice interview. The interviewer will work from this vetted plan instead of improvising domain facts live.

The candidate's scope (their own words):
${scopeBlock(scope)}
${jobPostingBlock(scope)}${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available.\n` : ""}
The candidate's materials (resume, job description, or both; location markers look like [page 3]):

${materialSections}

Build the plan. Return JSON only:
{"themes":[{"title","detail"}],"clarifyingQuestions":["..."],"questionPlan":[{"theme","questions":[{"question","followUp"}]}],"rubric":[{"theme","strong","weak"}],"verifyTopics":["..."],"candidateHooks":["..."]}

THEMES — 3 to 6. Each: "title" under 8 words, "detail" one line under 25 words on what will be probed and why it is real for this role at this level. Themes must fit the interview type: a screening call probes motivation, career story, and fit; a behavioral loop probes stories, ownership, and conflict; a technical session probes domain scenarios and trade-offs; a full loop mixes them.

CLARIFYING QUESTIONS — 0 to 3 short strings, and zero is the normal answer. Ask ONLY when something load-bearing is missing (which state, which license type, IC or manager track). Never ask for detail that merely sharpens flavor.

QUESTION PLAN — for every theme, 2 to 4 questions, each with a "followUp" angle (what to press when the answer stays surface-level). Questions are asked aloud: plain speech, no numbering. Where the materials include a resume, ground questions in it when natural.

RUBRIC — for every theme: "strong" is one line on what a strong answer looks like, "weak" one line on what a weak one looks like, specific to this role and seniority.

VERIFY TOPICS — only when the role or industry touches licensed or regulated territory (law, medicine, insurance, finance, licensing exams, state rules): list the specific topics, under 12 words each, where facts must be verified with official sources. Otherwise an empty array.

CANDIDATE HOOKS — 0 to 4, drawn only from an actual resume in the materials: specific, quotable hooks (e.g. "Led the ICU float pool through the Epic migration"). Empty when no resume was provided.

${HONEST_SCOPING}

Never use an em dash in any output value. If the scope is thin, a smaller honest plan beats an invented one.`

export const refineBlueprint = ({
  scope,
  blueprint: current,
  removedThemes,
  redirectNote,
}: BlueprintRefineInput) => {
  const answers = current.clarifyingQuestions
    .filter((entry) => entry.answer)
    .map((entry) => `- ${entry.question} → ${entry.answer}`)
    .join("\n")
  return `You are revising an interview blueprint after the candidate reviewed it. This is the single refinement pass; the plan locks after this.

The candidate's scope:
${scopeBlock(scope)}

The current plan (JSON):
${JSON.stringify({
    themes: current.themes,
    questionPlan: current.questionPlan,
    rubric: current.rubric,
    verifyTopics: current.verifyTopics,
    candidateHooks: current.candidateHooks,
  })}

The candidate's input:
- Answers to your clarifying questions:
${answers || "(none)"}
- Themes they removed (do not bring these back, under any name): ${removedThemes.join("; ") || "(none)"}
- Redirect note: ${redirectNote || "(none)"}

Rebuild the plan honoring all three. Keep what still fits, sharpen what the answers unlock, drop the removed themes, and rebalance questions toward what remains. Return JSON only, the same shape as the current plan, plus "clarifyingQuestions": [] — always the empty array; there is no second round of questions:
{"themes":[{"title","detail"}],"clarifyingQuestions":[],"questionPlan":[{"theme","questions":[{"question","followUp"}]}],"rubric":[{"theme","strong","weak"}],"verifyTopics":["..."],"candidateHooks":["..."]}

${HONEST_SCOPING}

Never use an em dash in any output value.`
}

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  scope,
  themes,
}: OrchestratePromptInput) =>
  `You are observing a live practice interview alongside ${characterName} (${characterRole}), taking notes in real time.

Interview context:
${scopeBlock(scope)}

${characterName}'s evaluation lens (guides what you watch hardest):
${characterTone}
${
    themes && themes.length > 0
      ? `\nThe prepared interview themes:\n${themes.map((theme) => `- ${theme}`).join("\n")}\nTrack which themes the conversation has actually covered; a follow_up note may flag a prepared theme not yet touched while time passes.\n`
      : ""
  }
What you listen for: specific stories over generalities ("I" over a hiding "we"), quantified outcomes, honest ownership of failures, reasoning that survives a why-chain, and whether the candidate answers the question that was actually asked. A strong answer is concrete, structured, and owned. A weak one is vague, borrowed, or evasive.

Produce ONE short observation (8-18 words) about the most recent candidate turn, or null if the turn contains nothing worth noting. Classify it:
- strong_answer: the candidate gave a concrete, owned, specific answer. Only when their own words demonstrably earn it; when unsure, no note
- weak_assumption: the candidate leaned on a vague or borrowed claim that won't hold up
- objection: the interviewer pushed back on something
- follow_up: a question still hanging, or a prepared theme not yet covered
- event: a notable shift in tone or topic

Also name the topic being discussed right now, in 5 words or fewer (e.g. "conflict story", "trade-off reasoning"). Use null if it is unclear.

Respond with JSON only, exactly this shape:
{"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"} | null,"topic":"<5 words or fewer>" | null}`

const engagementBlock = (continuity: DebriefPromptInput["continuity"]): string =>
  continuity
    ? `\nThe engagement so far (memory going into this session):
Previous summary: ${continuity.summary || "(none)"}
Commitments already tracked — open: ${continuity.open.join("; ") || "(none)"}; delivered: ${continuity.delivered.join("; ") || "(none)"}
`
    : ""

const rubricBlock = (blueprint: DebriefPromptInput["blueprint"]): string =>
  blueprint && blueprint.rubric.length > 0
    ? `\nThe pre-declared rubric from the interview blueprint — judge against THIS, not a generic bar:
${blueprint.rubric.map((entry) => `- ${entry.theme}: strong = ${entry.strong} / weak = ${entry.weak}`).join("\n")}
`
    : ""

const verifyBlock = (blueprint: DebriefPromptInput["blueprint"]): string =>
  blueprint && blueprint.verifyTopics.length > 0
    ? `\nRegulated territory flagged before the session (candidates for "verifyItems"): ${blueprint.verifyTopics.join("; ")}
`
    : ""

export const debrief = ({
  scope,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
  continuity,
  blueprint,
}: DebriefPromptInput) =>
  `You are an interview coach synthesizing a live practice interview into a debrief.

The candidate's scope:
${scopeBlock(scope)}
${engagementBlock(continuity)}${rubricBlock(blueprint)}${verifyBlock(blueprint)}
Interviewer who ran the session: ${characterName} (${characterRole})
Interviewer's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce the debrief. Return JSON ONLY with this exact shape:
{
  "title": "<a 2-4 word name for this session, e.g. \\"Owned the conflict story\\">",
  "verdict": {
    "decision": "move-forward" | "on-the-fence" | "not-yet",
    "summary": "one-sentence rationale"
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the candidate, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "whatHappened": "<one paragraph, 60-120 words, addressed to the candidate in the second person (\\"You told…\\") — concrete about what this session covered, which answers landed, and where the interview stalled>",
  "heldUp": [
    {"quote": "<the candidate's exact words from the transcript, copied verbatim>",
     "why": "<one line on why it landed>"}
  ],
  "didntHold": [
    {"text": "<an answer that fell apart under follow-up, or something missing or unproven, short>", "ref": null}
  ],
  "verifyItems": [
    {"text": "<what to confirm and with whom, e.g. \\"Confirm Georgia's licensing requirements on X with the state board\\">"}
  ],
  "continuity": {
    "summary": "<2-4 sentences a coach could read before the next session: where the candidate stands, what improved, what remains weak>",
    "actionItems": [
      {"text": "<a concrete thing to prepare or fix before the next session — starts with a verb, under 15 words>", "priority": "high" | "medium" | "low"}
    ]
  }
}

"heldUp" holds 0 to 3 items; "didntHold" holds 0 to 4. "ref" is always null in this lane.

"verifyItems" holds 0 to 4 items, ONLY for facts in regulated or licensed territory that came up and that neither you nor ${characterName} can vouch for. This is not feedback on weak answers — those belong in "didntHold"; a verify item means the interviewer could not vouch for a fact. When nothing regulated came up, return [].

"continuity" is the practice thread's compounding memory, not a session note. For the summary: UPDATE the previous summary rather than writing a fresh one — carry forward the durable facts and the arc (stories that work, weaknesses that persist, what's been fixed), fold in what this session changed, and drop only what is fully resolved. Each action item will be read back to the candidate as "last time you said you'd …". 0 to 5 items; never repeat or rephrase a commitment already tracked as open or delivered; if nothing new emerged, return an empty list — never invent a commitment.

CALIBRATION. The candidate's trust depends on honest feedback; never inflate:
- Judge only what the transcript shows. Every sentence of "whatHappened" must trace to actual turns; never credit intent, effort, or content that did not occur.
- If the candidate said little or nothing, "whatHappened" is one plain sentence saying exactly that, the decision is "not-yet", and "spokenVerdict" is ${characterName}'s honest reaction to the non-engagement. "spokenVerdict" is always a judgment of the candidate's performance, never a restatement of a question ${characterName} asked.
- Verdicts are earned: "move-forward" only when the transcript demonstrates it. Torn between two tiers? Choose the lower.
- "didntHold" names what actually went wrong in THIS conversation, not a best-practices checklist. Two real findings beat four generic ones.
- Write plainly. Never use em dashes in any output field.

Be concrete and specific: every line should mention something tied to THIS candidate's role and answers, not generic interview advice.

${HONEST_SCOPING}

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative answers the candidate actually gave that withstood the interviewer's follow-up (specific stories, numbers, owned decisions), each quoted verbatim in "quote". An admission that something is missing, untested, or unknown is NOT an answer that held up — leave it out. If the candidate gave no defensible answers, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "continuity" action items, never in "heldUp".
- Nowhere in the debrief state specifics the transcript does not contain (companies, numbers, technologies, regulations). Where the candidate provided nothing, say so plainly.`
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `node --test src/domains/interview/prompts.test.ts`
Expected: PASS.

- [ ] **Step 4: Full suite**

Run: `pnpm test` — Expected: PASS. Stop for review.

---

### Task 6: Interview room briefing

**Files:**
- Create: `src/domains/interview/briefing.ts`
- Test: `src/domains/interview/briefing.test.ts`

**Interfaces:**
- Consumes: `BriefingInput` (with optional `blueprint`, Task 2), `Blueprint` (Task 1), helpers from `../types.ts`, `bySpokenTime` from `../../lib/transcript.ts`.
- Produces: `turnTaking: string`, `buildRoomBriefing(input: BriefingInput): RoomBriefing` (Task 7 wires them into the pack; `/api/avatar/connect` composes them).
- Section priority (drop-whole order under the 4k `PREAMBLE_BUDGET`): role framing → continuity → compressed question plan → honest scoping (only when `verifyTopics` non-empty) → candidate hooks. Honest scoping sits **above** hooks by design (spec test requirement).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/interview/briefing.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import { PREAMBLE_BUDGET } from "../types.ts"
import type { Blueprint } from "../../lib/blueprint.ts"

const scope = {
  roleTitle: "ICU Nurse",
  interviewType: "Behavioral",
  seniority: "Senior",
  industryContext: "regional hospital ICU",
  focusAreas: ["Ownership"],
}

const makeBlueprint = (overrides: Partial<Blueprint> = {}): Blueprint => ({
  status: "ready",
  themes: [{ title: "Patient escalation", detail: "How they escalate under pressure" }],
  clarifyingQuestions: [],
  questionPlan: [
    {
      theme: "Patient escalation",
      questions: [
        { question: "Tell me about a night the unit was short-staffed", followUp: "Their call" },
        { question: "When did you last override a protocol?", followUp: "Why" },
        { question: "A third question that never makes the compressed plan", followUp: "x" },
      ],
    },
  ],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
  ...overrides,
})

test("a fresh session frames the role and works from the question plan", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.personalityPreamble, /interviewing a candidate for "ICU Nurse"/)
  assert.match(briefing.personalityPreamble, /Senior/)
  assert.match(briefing.personalityPreamble, /regional hospital ICU/)
  assert.match(briefing.personalityPreamble, /short-staffed/)
  // Compressed plan: only the first two questions per theme survive.
  assert.doesNotMatch(briefing.personalityPreamble, /third question/)
  assert.match(briefing.startScript, /tell me about yourself/i)
})

test("a session without a usable blueprint still frames the role and never mentions a plan", () => {
  const failed = makeBlueprint({ status: "failed" })
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: failed,
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.personalityPreamble, /ICU Nurse/)
  assert.doesNotMatch(briefing.personalityPreamble, /question plan/i)
  assert.doesNotMatch(briefing.startScript, /your background/)
})

test("honest scoping appears exactly when verifyTopics is non-empty, above candidate hooks", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint({
      verifyTopics: ["Georgia nursing license renewal"],
      candidateHooks: ["Led the Epic migration"],
    }),
    continuity: null,
    transcript: [],
  })
  const scopingAt = briefing.personalityPreamble.indexOf("Georgia nursing license renewal")
  const hooksAt = briefing.personalityPreamble.indexOf("Led the Epic migration")
  assert.ok(scopingAt !== -1)
  assert.ok(hooksAt !== -1)
  assert.ok(scopingAt < hooksAt)
  const clean = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [],
  })
  assert.doesNotMatch(clean.personalityPreamble, /never state statutes/i)
})

test("under budget pressure, sections drop whole from the back: hooks go before scoping", () => {
  const longPlan = makeBlueprint({
    themes: Array.from({ length: 6 }, (_, i) => ({ title: `Theme ${i}`, detail: "d" })),
    questionPlan: Array.from({ length: 6 }, (_, i) => ({
      theme: `Theme ${i}`,
      questions: [
        { question: `Q${i}A ${"x".repeat(220)}`, followUp: "f" },
        { question: `Q${i}B ${"x".repeat(220)}`, followUp: "f" },
      ],
    })),
    verifyTopics: ["Georgia nursing license renewal", "Compact state rules"],
    candidateHooks: Array.from({ length: 4 }, (_, i) => `Hook ${i} ${"y".repeat(140)}`),
  })
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: longPlan,
    continuity: null,
    transcript: [],
  })
  // Sanity: the full section set genuinely exceeds the budget…
  assert.ok(briefing.personalityPreamble.length <= PREAMBLE_BUDGET + 2)
  // …the plan and the scoping survive, the hooks dropped whole.
  assert.match(briefing.personalityPreamble, /Q0A/)
  assert.match(briefing.personalityPreamble, /Georgia nursing license renewal/)
  assert.doesNotMatch(briefing.personalityPreamble, /Hook 0/)
})

test("a resume digests recent turns in speech order and never re-introduces", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: null,
    transcript: [
      { text: "My answer about escalation", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "How do you escalate?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  const questionAt = briefing.personalityPreamble.indexOf("How do you escalate?")
  const answerAt = briefing.personalityPreamble.indexOf("My answer about escalation")
  assert.ok(questionAt !== -1 && answerAt !== -1 && questionAt < answerAt)
  assert.match(briefing.startScript, /pick it up wherever you left it/i)
})

test("open commitments drive the opener and forbid re-introduction", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    blueprint: makeBlueprint(),
    continuity: {
      lastSessionSummary: "Conflict stories still borrow the team's work.",
      actionItems: [
        {
          id: "s1:0",
          text: "Prepare a second conflict story",
          priority: "high" as const,
          status: "open" as const,
          createdAt: 1,
        },
      ],
      updatedAt: 1,
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /last time you said you'd prepare a second conflict story/i)
  assert.match(briefing.personalityPreamble, /do not introduce yourself/i)
  assert.match(briefing.personalityPreamble, /borrow the team's work/)
})
```

Run: `node --test src/domains/interview/briefing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Write the briefing builder**

Create `src/domains/interview/briefing.ts`:

```ts
import { bySpokenTime } from "../../lib/transcript.ts"
import {
  composeWithinBudget,
  deliveredItems,
  openItems,
  scopeText,
  spokenCommitment,
  type BriefingInput,
  type RoomBriefing,
} from "../types.ts"

// Same pause discipline as the other lanes, in the interviewer's frame: the
// GWM engine fills silence with presence check-ins, and an interviewer who
// narrates the candidate's thinking pauses reads as not listening.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the candidate's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
candidate pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: probe, follow up, and press exactly as your character demands.

`

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160
// The room hears at most this many questions per theme — the full plan
// lives in the debrief's rubric, not the preamble budget.
const PLAN_QUESTIONS_PER_THEME = 2

// Per-session avatar briefing, assembled from what the app already knows.
// Sections are ordered by priority and drop whole under the preamble
// budget; honest scoping deliberately outranks resume hooks so the
// guardrail survives whenever regulated territory was flagged.
export const buildRoomBriefing = ({
  scope,
  blueprint,
  continuity,
  transcript,
}: BriefingInput): RoomBriefing => {
  const role = scopeText(scope, "roleTitle")
  const seniority = scopeText(scope, "seniority")
  const industry = scopeText(scope, "industryContext")
  const interviewType = scopeText(scope, "interviewType") || "Full loop (mixed)"
  // Only a landed blueprint briefs the room; generating or failed means the
  // interviewer runs on role framing alone.
  const plan =
    blueprint && (blueprint.status === "ready" || blueprint.status === "awaiting-input")
      ? blueprint
      : null

  if (transcript.length > 0) {
    const digest = bySpokenTime(transcript)
      .slice(-DIGEST_TURNS)
      .map((e) => `${e.type === "user" ? "CANDIDATE" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
      .join("\n")
    return {
      personalityPreamble: `Session context: this resumes an earlier practice interview with the same candidate for "${role}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the interview from there.\n\n`,
      startScript:
        "Good, you're back. We were mid-interview, so go ahead — pick it up wherever you left it.",
    }
  }

  const framing = `Session context: you are interviewing a candidate for "${role}"${
    seniority ? ` at ${seniority} level` : ""
  }${industry ? `, in this context: ${industry}` : ""}. Format: ${interviewType}. This is a live practice interview; run it exactly like the real thing.`

  const planSection =
    plan && plan.questionPlan.length > 0
      ? ` Your prepared question plan, by theme: ${plan.questionPlan
          .map(
            (entry) =>
              `${entry.theme}: ${entry.questions
                .slice(0, PLAN_QUESTIONS_PER_THEME)
                .map((q) => q.question)
                .join(" / ")}`
          )
          .join(" · ")}. Work from this plan, in your own words; follow the candidate's answers deeper before moving to the next theme.`
      : ""

  const scoping =
    plan && plan.verifyTopics.length > 0
      ? ` Honest scoping (absolute): never state statutes, state rules, licensing requirements, or exam content as fact. In this session that covers: ${plan.verifyTopics.join(
          "; "
        )}. Probe how the candidate reasons about these and how they would verify with official sources; never quiz for a "correct" regulatory answer.`
      : ""

  const hooks =
    plan && plan.candidateHooks.length > 0
      ? ` From the candidate's background, worth probing directly: ${plan.candidateHooks.join(
          "; "
        )}. Raise these naturally, the way a prepared interviewer does ("I see you led X, tell me about that").`
      : ""

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have interviewed this candidate for "${role}" in an earlier session; do not introduce yourself as if meeting for the first time.`,
        open.length > 0
          ? ` They committed to: ${open.map((item) => item.text).join("; ")}. Follow up on these before anything new.`
          : "",
        delivered.length > 0
          ? ` They have already delivered: ${delivered.map((item) => item.text).join("; ")} — acknowledge briefly if relevant and do not ask again.`
          : "",
        continuity.lastSessionSummary
          ? ` Where the last session left off: ${continuity.lastSessionSummary}`
          : "",
      ]
    : []

  const startScript =
    open.length > 0
      ? `Good to see you again. Before we get into new ground — last time you said you'd ${spokenCommitment(open[0])}. Where did that land?`
      : plan && plan.candidateHooks.length > 0
        ? `Thanks for coming in. I've gone through the role and your background, and I've got a plan for our time. Let's start simple — tell me about yourself and what's drawing you to this role.`
        : `Thanks for coming in. Let's start simple — tell me about yourself and what's drawing you to this role.`

  return {
    personalityPreamble:
      composeWithinBudget([framing, ...continuityContext, planSection, scoping, hooks]) + "\n\n",
    startScript,
  }
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test src/domains/interview/briefing.test.ts`
Expected: PASS. If the budget-pressure test fails because everything fit, lengthen its question padding (`"x".repeat(220)` → higher) rather than reordering sections — but with 6 themes × 2 × ~225 chars the plan section alone is ~2800 chars, framing ~180, scoping ~330, hooks ~600: total ~3900 + separators exceeds 4000 with hooks and fits without, which is the point.

- [ ] **Step 4: Full suite**

Run: `pnpm test` — Expected: PASS. Stop for review.

---

### Task 7: Interview pack assembly and registration in the registry

**Files:**
- Create: `src/domains/interview/pack.ts`
- Modify: `src/domains/registry.ts`
- Modify: `src/domains/registry.test.ts` (extend for the fourth pack)

**Interfaces:**
- Consumes: `INTERVIEWER_PERSONAS` (Task 4), prompts (Task 5), briefing (Task 6), prep types (Task 2).
- Produces: `interviewPack: DomainPack` with `id: "interview"`, `prep.kind: "blueprint"`, verdicts `move-forward`/`on-the-fence`/`not-yet`. Registered in `PACKS` (which makes it appear on `/welcome`, in settings, and in `users.lanes` validation automatically).

- [ ] **Step 1: Extend the registry test (failing)**

In `src/domains/registry.test.ts`, extend the first test:

```ts
  assert.equal(ALL_PACKS.length, 4)
  assert.equal(PACKS.interview.prep.kind, "blueprint")
```

and add:

```ts
test("the interview lane's cast and vocabulary match the spec", () => {
  assert.deepEqual(
    PACKS.interview.personas.map((persona) => persona.id),
    ["screener-01", "hm-01", "practitioner-01"]
  )
  assert.deepEqual(
    PACKS.interview.verdicts.options.map((option) => option.value),
    ["move-forward", "on-the-fence", "not-yet"]
  )
  assert.equal(PACKS.interview.verdicts.fallback, "on-the-fence")
  assert.equal(PACKS.interview.subjectField, "roleTitle")
  // The engine's focusAreas persona heuristic and the session-meta key.
  assert.ok(PACKS.interview.scopeFields.some((field) => field.key === "focusAreas"))
  assert.equal(PACKS.interview.sessionMetaField, "interviewType")
})

test("the interview recommendation follows the interview type and defaults to the full loop", () => {
  const recommend = PACKS.interview.recommendPersona
  assert.ok(recommend)
  assert.equal(recommend({ interviewType: "Screening call" })?.personaId, "screener-01")
  assert.equal(recommend({ interviewType: "Behavioral" })?.personaId, "hm-01")
  assert.equal(recommend({ interviewType: "Technical & scenarios" })?.personaId, "practitioner-01")
  assert.equal(recommend({ interviewType: "Full loop (mixed)" })?.personaId, "hm-01")
  assert.equal(recommend({})?.personaId, "hm-01")
})
```

Run: `node --test src/domains/registry.test.ts` — Expected: FAIL (no interview pack).

- [ ] **Step 2: Write the pack**

Create `src/domains/interview/pack.ts`:

```ts
import { INTERVIEWER_PERSONAS } from "./personas.ts"
import { scopeText, type DomainPack, type Scope } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import {
  analyzeSystem,
  analyzeUser,
  blueprint,
  debrief,
  extractScope,
  orchestrate,
  refineBlueprint,
} from "./prompts.ts"

// Labels are the stored scope values and appear verbatim in the
// extractScope prompt; keep both in lockstep.
const INTERVIEW_TYPE_OPTIONS = [
  { value: "screening", label: "Screening call" },
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical & scenarios" },
  { value: "full-loop", label: "Full loop (mixed)" },
]

const SENIORITY_OPTIONS = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "leadership", label: "Leadership" },
]

const FOCUS_AREA_OPTIONS = [
  "Motivation & fit",
  "Career story",
  "Behavioral stories",
  "Ownership",
  "Conflict",
  "Technical depth",
  "Scenario judgment",
  "Communication",
].map((label) => ({ value: label, label }))

// Interview formats are few and stable, so the format drives the
// recommended interviewer; an unset format reads as a full loop.
const TYPE_TO_PERSONA: Record<string, { personaId: string; reason: string }> = {
  "Screening call": { personaId: "screener-01", reason: "Built for the screen" },
  Behavioral: { personaId: "hm-01", reason: "Built for behavioral loops" },
  "Technical & scenarios": { personaId: "practitioner-01", reason: "Built for the deep-dive" },
  "Full loop (mixed)": { personaId: "hm-01", reason: "Anchors a full loop" },
}

export const interviewPack: DomainPack = {
  id: "interview",
  label: "Practice an interview",
  shortLabel: "Interview",
  description:
    "Face the interview before the real one. The panel builds a role-specific blueprint from your role and materials, interviews you live from that plan, then debriefs on what held up.",
  subjectField: "roleTitle",
  subtitleFields: ["seniority", "interviewType"],
  userLabel: "CANDIDATE",
  userTitle: "Candidate",
  scopeFields: [
    {
      key: "roleTitle",
      label: "The role",
      kind: "text",
      required: true,
      maxLength: 80,
      placeholder: "e.g. Engineering Manager, frontend teams",
    },
    {
      key: "interviewType",
      label: "Interview type",
      kind: "chips",
      options: INTERVIEW_TYPE_OPTIONS,
    },
    { key: "seniority", label: "Seniority", kind: "chips", options: SENIORITY_OPTIONS },
    {
      key: "industryContext",
      label: "Industry or company context",
      kind: "text",
      maxLength: 120,
      placeholder: "e.g. regional hospital ICU, B2B SaaS startup",
    },
    {
      key: "focusAreas",
      label: "Where do you want the pressure?",
      kind: "multi",
      options: FOCUS_AREA_OPTIONS,
    },
    {
      key: "jobPosting",
      label: "Job posting",
      kind: "textarea",
      maxLength: 4000,
      placeholder: "Paste the job description if you have one",
    },
  ],
  contextFields: [
    { key: "roleSummary", label: "Role summary" },
    { key: "interviewShape", label: "Interview shape" },
    { key: "pressureAreas", label: "Pressure areas" },
    { key: "riskiestGap", label: "Riskiest gap" },
    { key: "openQuestions", label: "Open questions" },
  ],
  verdicts: {
    options: [
      { value: "move-forward", label: "Would move you forward", tone: "good" },
      { value: "on-the-fence", label: "On the fence", tone: "mid" },
      { value: "not-yet", label: "Wouldn't advance you yet", tone: "bad" },
    ],
    fallback: "on-the-fence",
  },
  prep: {
    kind: "blueprint",
    stepLabel: "Blueprint",
    prompt: blueprint,
    refine: refineBlueprint,
    wait: {
      kicker: "The blueprint · before the room",
      heading: (subject) => `Building the interview plan for ${subject}.`,
      lead: "Your interviewer walks in with a vetted, role-specific plan — not improvised questions. This takes a few seconds.",
      rows: [
        { label: "The role", text: "Reading what this role actually demands…" },
        { label: "Level", text: "Calibrating the pressure to your seniority…" },
        { label: "Materials", text: "Mining your resume and the posting for hooks…" },
        { label: "Themes", text: "Choosing what this interview will probe…" },
        { label: "Questions", text: "Writing the questions and follow-up angles…" },
        { label: "Rubric", text: "Pre-declaring what strong and weak look like…" },
      ],
      work: [
        "Reading your scope",
        "Profiling the role",
        "Drafting the themes",
        "Sealing the questions",
        "Writing the rubric",
      ],
      ticker: [
        "You'll see the themes; the questions stay sealed until the room.",
        "Feedback traces to a rubric written before you speak.",
        "Regulated facts get flagged to verify, never asserted.",
        "A thin brief makes a thin plan. Gaps become clarifying questions.",
      ],
      stepMs: 2000,
    },
    copy: {
      kicker: "The blueprint · before the room",
      readyHeading: "Here's what your interviewer prepared.",
      readyLead:
        "These are the themes your interview will probe — the actual questions stay sealed until the room. Cut what you don't want, redirect the focus, and answer anything they asked. One revision, then it locks.",
      cta: "Lock it in",
    },
  },
  sessionMetaField: "interviewType",
  recommendPersona: (scope: Scope) =>
    TYPE_TO_PERSONA[scopeText(scope, "interviewType")] ?? TYPE_TO_PERSONA["Full loop (mixed)"],
  copy: {
    tellIt: {
      heading: "What are you interviewing for?",
      sub: "Talk through the role, the context, and where you want the pressure. It gets shaped into a brief you'll confirm.",
    },
    form: {
      sections: [
        { title: "The role", keys: ["roleTitle", "industryContext", "jobPosting"] },
        {
          title: "The interview",
          meta: "optional · sharpens the blueprint",
          keys: ["interviewType", "seniority", "focusAreas"],
        },
      ],
      materialsTitle: "Materials",
      materialsMeta: "optional · resume or JD · PDF PPTX XLSX DOCX",
    },
    preview: {
      title: "What your interviewer will read",
      rows: [
        { key: "roleTitle", label: "The role", hint: "Not yet named" },
        {
          key: "industryContext",
          label: "Context",
          hint: "Company, industry, or region — it shapes the questions",
        },
        {
          key: "jobPosting",
          label: "Job posting",
          hint: "Paste it and the plan speaks the company's language",
        },
      ],
      chips: { label: "Format and focus", keys: ["interviewType", "seniority", "focusAreas"] },
      footer: "Only what you put here makes it in; gaps become questions, not guesses.",
    },
    readWait: {
      kicker: "Reading your brief",
      heading: () => "Going through what you gave us.",
      lead: "The blueprint is built from every line you wrote. This takes a few seconds.",
      rows: [
        { label: "The role", text: "Registering what you're interviewing for…" },
        { label: "Context", text: "Placing the role in its industry…" },
        { label: "Format", text: "Reading the shape of the interview…" },
        { label: "Seniority", text: "Calibrating the level of pressure…" },
        { label: "Focus", text: "Noting where you asked for the heat…" },
      ],
      work: [
        "Parsing your scope",
        "Profiling the role",
        "Weighing the seniority bar",
        "Naming the riskiest gap",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented. If we didn't catch it, we ask.",
        "A gap is a finding, not a failure.",
        "Your interviewer reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    panel: {
      kicker: "Meet your interviewers",
      heading: "Who's across the table?",
      lead: "Each runs a different kind of interview from the same blueprint. Start with the format you're actually facing.",
    },
    promptHelpers: [
      "The situation was…",
      "What I actually did was…",
      "The way I'd verify that…",
      "Looking back, I'd change…",
    ],
  },
  personas: INTERVIEWER_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, orchestrate, debrief, extractScope },
}
```

- [ ] **Step 3: Register it**

In `src/domains/registry.ts`:

```ts
import { interviewPack } from "./interview/pack.ts"
```

and add to `PACKS`:

```ts
  [interviewPack.id]: interviewPack,
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/domains/registry.test.ts` — Expected: PASS (including cross-pack verdict distinctness).
Run: `pnpm test` — Expected: PASS.
Run: `pnpm lint` — Expected: clean. Stop for review.

---

### Task 8: Convex blueprint pipeline and engine wiring

**Files:**
- Modify: `convex/schema.ts` (practices.blueprint field)
- Create: `convex/blueprints.ts`
- Modify: `convex/ingest.ts` (settle re-trigger branches by prep kind)
- Modify: `convex/orchestrator.ts` (pass blueprint themes)
- Modify: `convex/sessions.ts` (`generateDebrief` passes rubric/verifyTopics)
- Modify: `src/app/api/avatar/connect/route.ts` (pass blueprint into the briefing)

**Interfaces:**
- Consumes: `blueprintValidator`, `parseBlueprint`, `blueprintStatusFor`, `canClaimBlueprint`, `canRequestRefinement`, validators and constants from `src/lib/blueprint.ts` (Task 1); `internal.practices.auditInputs`, `internal.practices.prepKind` (Task 2); `pack.prep` narrowing.
- Produces (Task 9's UI calls these):
  - `api.blueprints.run` — action `{ id: Id<"practices">, force?: boolean }` → `void`. Idempotent start; also the retry for both generation and refinement failures.
  - `api.blueprints.requestRefinement` — mutation `{ id: Id<"practices">, answers: { question: string, answer: string }[], removedThemes: string[], redirectNote: string }`. Clamps and stores, then schedules the refine run. Throws `"The plan has already been refined"` on a second request and `"Nothing to refine"` on an empty one.
  - `internal.blueprints.runInternal` — scheduler entry.

- [ ] **Step 1: Schema field**

In `convex/schema.ts`, add the import:

```ts
import { blueprintValidator } from "../src/lib/blueprint"
```

and in the `practices` table, after the `audit` field:

```ts
    // The interview lane's prep artifact: themes and clarifying questions
    // are shown to the user; questionPlan and rubric are sealed (stored
    // here, never rendered client-side). Only blueprint-prep lanes write
    // it. Ownership and fail-closed reads are inherited from the practice
    // document — no new tables, no new indexes.
    blueprint: v.optional(blueprintValidator),
```

Run: `npx convex codegen` — Expected: clean regeneration.

- [ ] **Step 2: Write `convex/blueprints.ts`**

```ts
import { v } from "convex/values"
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  type ActionCtx,
} from "./_generated/server"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { createOpenAI, resolveModel } from "../src/lib/openai"
import { getPack } from "../src/domains/registry"
import {
  ANSWER_CHARS,
  REDIRECT_NOTE_CHARS,
  blueprintStatusFor,
  canClaimBlueprint,
  canRequestRefinement,
  clarifyingQuestionValidator,
  parseBlueprint,
  questionPlanEntryValidator,
  rubricEntryValidator,
  themeValidator,
} from "../src/lib/blueprint"
import { ownedOrNull, requireIdentity } from "./guard"

// Same discipline as the audit pipeline: one claim slot on the embedded
// field so concurrent triggers collapse, a fixed user-facing failure
// message (provider error text never reaches the client), and the quality
// model tier for the generation itself.
const PROMPT_CHAR_BUDGET = 60_000
const FAILURE_MESSAGE = "The blueprint hit an error. Re-run it to try again."

const EMPTY_CONTENT = {
  themes: [],
  clarifyingQuestions: [],
  questionPlan: [],
  rubric: [],
  verifyTopics: [],
  candidateHooks: [],
}

export const claim = internalMutation({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return false
    const existing = practice.blueprint ?? null
    if (!canClaimBlueprint(existing, args.force ?? false)) return false
    await ctx.db.patch(args.id, {
      // Keep the previous plan until the new outcome lands: a re-run that
      // fails must not have destroyed the last good blueprint.
      blueprint: existing
        ? { ...existing, status: "generating", failureMessage: undefined }
        : { status: "generating", ...EMPTY_CONTENT },
    })
    return true
  },
})

export const setOutcome = internalMutation({
  args: {
    id: v.id("practices"),
    outcome: v.union(
      v.object({
        status: v.literal("ready"),
        themes: v.array(themeValidator),
        clarifyingQuestions: v.array(clarifyingQuestionValidator),
        questionPlan: v.array(questionPlanEntryValidator),
        rubric: v.array(rubricEntryValidator),
        verifyTopics: v.array(v.string()),
        candidateHooks: v.array(v.string()),
      }),
      v.object({ status: v.literal("failed"), failureMessage: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    const practice = await ctx.db.get(args.id)
    if (!practice) return
    const previous = practice.blueprint
    if (args.outcome.status === "failed") {
      await ctx.db.patch(args.id, {
        blueprint: {
          ...(previous ?? EMPTY_CONTENT),
          status: "failed",
          failureMessage: args.outcome.failureMessage,
        },
      })
      return
    }
    const refining = previous?.refinement !== undefined && !previous.refinement.completed
    // Refinement closes after one pass: the answered questions are kept for
    // display, the pass's own clarifyingQuestions are discarded, and the
    // status lands on ready — there is no second round.
    const clarifyingQuestions = refining
      ? (previous?.clarifyingQuestions ?? [])
      : args.outcome.clarifyingQuestions
    await ctx.db.patch(args.id, {
      blueprint: {
        status: refining ? "ready" : blueprintStatusFor(clarifyingQuestions),
        themes: args.outcome.themes,
        clarifyingQuestions,
        questionPlan: args.outcome.questionPlan,
        rubric: args.outcome.rubric,
        verifyTopics: args.outcome.verifyTopics,
        candidateHooks: args.outcome.candidateHooks,
        ...(previous?.refinement
          ? { refinement: { ...previous.refinement, completed: true } }
          : {}),
      },
    })
  },
})

const generateBlueprint = async (
  ctx: ActionCtx,
  args: { id: Id<"practices">; force?: boolean }
): Promise<void> => {
  // Materials still extracting: don't build a materials-blind plan. The
  // last extraction to settle re-triggers this via ingest.extract.
  const settled = await ctx.runQuery(internal.materials.allSettled, { practiceId: args.id })
  if (!settled) return

  const claimed = await ctx.runMutation(internal.blueprints.claim, {
    id: args.id,
    force: args.force,
  })
  if (!claimed) return

  const fail = () =>
    ctx.runMutation(internal.blueprints.setOutcome, {
      id: args.id,
      outcome: { status: "failed", failureMessage: FAILURE_MESSAGE },
    })

  try {
    const { practice, readable, unreadableCount } = await ctx.runQuery(
      internal.practices.auditInputs,
      { id: args.id }
    )
    if (!practice) {
      await fail()
      return
    }
    const pack = getPack(practice.packId)
    if (pack.prep.kind !== "blueprint") {
      await fail()
      return
    }

    const perMaterialBudget =
      readable.length > 0 ? Math.floor(PROMPT_CHAR_BUDGET / readable.length) : 0
    const materialSections =
      readable.length > 0
        ? readable
            .map(
              (material) =>
                `=== ${material.name} ===\n${material.text.slice(0, perMaterialBudget)}`
            )
            .join("\n\n")
        : "(No materials were provided.)"

    const current = practice.blueprint
    const refinement =
      current?.refinement !== undefined && !current.refinement.completed
        ? current.refinement
        : null
    const prompt =
      refinement && current
        ? pack.prep.refine({
            scope: practice.scope,
            blueprint: current,
            removedThemes: refinement.removedThemes,
            redirectNote: refinement.redirectNote,
          })
        : pack.prep.prompt({ scope: practice.scope, unreadableCount, materialSections })

    const openai = await createOpenAI()
    const response = await openai.chat.completions.create({
      model: resolveModel("quality"),
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      await fail()
      return
    }
    const parsed = parseBlueprint(JSON.parse(content))
    if (!parsed) {
      await fail()
      return
    }
    await ctx.runMutation(internal.blueprints.setOutcome, {
      id: args.id,
      outcome: { status: "ready", ...parsed },
    })
  } catch (error) {
    // Fixed message only — raw error goes to the server log.
    console.error("[blueprints.run]", error)
    await fail()
  }
}

export const run = action({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<void> => {
    await requireIdentity(ctx)
    // Ownership-scoped read: someone else's practice reads as missing and
    // no model call is spent on it.
    const practice = await ctx.runQuery(api.practices.get, { id: args.id })
    if (!practice) return
    await generateBlueprint(ctx, args)
  },
})

// Scheduler entry: ingest.extract and requestRefinement fire this without a
// user identity.
export const runInternal = internalAction({
  args: { id: v.id("practices"), force: v.optional(v.boolean()) },
  handler: generateBlueprint,
})

// The single refinement pass: stores the user's answers, removals, and
// redirect note (clamped like all scope text), then schedules the run that
// consumes them. One request per blueprint, enforced server-side.
export const requestRefinement = mutation({
  args: {
    id: v.id("practices"),
    answers: v.array(v.object({ question: v.string(), answer: v.string() })),
    removedThemes: v.array(v.string()),
    redirectNote: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const practice = ownedOrNull(identity, await ctx.db.get(args.id))
    const blueprint = practice?.blueprint
    if (!practice || !blueprint) throw new Error("Practice not found")
    if (!canRequestRefinement(blueprint)) throw new Error("The plan has already been refined")

    const answered = blueprint.clarifyingQuestions.map((entry) => {
      const match = args.answers.find((answer) => answer.question === entry.question)
      const answer = match?.answer.trim().slice(0, ANSWER_CHARS)
      return answer ? { ...entry, answer } : entry
    })
    const themeTitles = new Set(blueprint.themes.map((theme) => theme.title))
    const removedThemes = [...new Set(args.removedThemes.filter((title) => themeTitles.has(title)))]
    if (removedThemes.length >= blueprint.themes.length) {
      throw new Error("At least one theme must remain")
    }
    const redirectNote = args.redirectNote.trim().slice(0, REDIRECT_NOTE_CHARS)
    const answeredAnything = answered.some(
      (entry, i) => entry.answer && !blueprint.clarifyingQuestions[i].answer
    )
    if (!answeredAnything && removedThemes.length === 0 && redirectNote.length === 0) {
      throw new Error("Nothing to refine")
    }

    await ctx.db.patch(args.id, {
      blueprint: {
        ...blueprint,
        clarifyingQuestions: answered,
        refinement: { removedThemes, redirectNote, completed: false },
      },
    })
    await ctx.scheduler.runAfter(0, internal.blueprints.runInternal, { id: args.id })
  },
})
```

- [ ] **Step 3: Route the materials-settled trigger by prep kind**

In `convex/ingest.ts`, replace the settle block at the end of `extract`:

```ts
    // Kick the lane's prep stage once the last material settles; the claim
    // mutations collapse concurrent triggers to a single run.
    const settled = await ctx.runQuery(internal.materials.allSettled, {
      practiceId: material.practiceId,
    })
    if (settled) {
      const kind = await ctx.runQuery(internal.practices.prepKind, {
        id: material.practiceId,
      })
      await ctx.scheduler.runAfter(
        0,
        kind === "blueprint"
          ? internal.blueprints.runInternal
          : internal.practices.runAuditInternal,
        { id: material.practiceId }
      )
    }
```

- [ ] **Step 4: Feed the blueprint to the room, the orchestrator, and the debrief**

`src/app/api/avatar/connect/route.ts` — in `authorizeSession`, add to the `pack.briefing({...})` input after `audit`:

```ts
        blueprint: practice.blueprint ?? null,
```

`convex/orchestrator.ts` — in `decide`, extend the `pack.prompts.orchestrate({...})` input:

```ts
            scope: practice.scope,
            themes: practice.blueprint?.themes.map((theme) => theme.title) ?? null,
```

`convex/sessions.ts` — in `generateDebrief`, extend the `pack.prompts.debrief({...})` input after `continuity`:

```ts
            blueprint: practice.blueprint
              ? {
                  rubric: practice.blueprint.rubric,
                  verifyTopics: practice.blueprint.verifyTopics,
                }
              : null,
```

- [ ] **Step 5: Verify**

Run: `npx convex codegen` — Expected: clean (this materializes `api.blueprints.*` for Task 9).
Run: `pnpm test` — Expected: PASS.
Run: `pnpm lint` — Expected: clean. Stop for review.

---

### Task 9: Blueprint stage UI and the `/audit` route branch

**Files:**
- Create: `src/components/simulation/intake/BlueprintStage.tsx`
- Modify: `src/app/(flow)/simulation/[id]/audit/page.tsx`

**Interfaces:**
- Consumes: `api.blueprints.run`, `api.blueprints.requestRefinement` (Task 8), `pack.prep` (kind `"blueprint"`: `wait`, `copy` — Task 2/7), `MAX_CLARIFYING`/`ANSWER_CHARS`/`REDIRECT_NOTE_CHARS` char caps (Task 1), `WaitingScreen`, `IdeaNotFound`, `StageKicker`, `BTN_PRIMARY`/`BTN_SECONDARY`, `FIELD_INPUT` from `ScopeFields`.
- Behavior contract: themes visible and removable, clarifying questions answered inline, one optional redirect note; all of it submits through **one** "Update the plan" action; after the single refinement the editing affordances disappear; `questionPlan`/`rubric` are never rendered; the CTA to `/panel` is always available in `ready`/`awaiting-input`.

- [ ] **Step 1: Write `BlueprintStage.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, X } from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { REDIRECT_NOTE_CHARS, ANSWER_CHARS } from "@/lib/blueprint"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { FIELD_INPUT } from "@/components/simulation/intake/ScopeFields"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

type BlueprintStageProps = {
  simulationId: string
}

// The interview lane's prep stage: themes visible, questions sealed. The
// user can cut themes, answer clarifying questions, and add one redirect
// note; all of it feeds the single refinement pass, then the plan locks.
export const BlueprintStage = ({ simulationId }: BlueprintStageProps) => {
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const runBlueprint = useAction(api.blueprints.run)
  const requestRefinement = useMutation(api.blueprints.requestRefinement)
  const [startFailed, setStartFailed] = useState(false)
  const [removed, setRemoved] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [redirectNote, setRedirectNote] = useState("")
  const [refineError, setRefineError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoStartedRef = useRef(false)

  const handleRun = () => {
    setStartFailed(false)
    runBlueprint({ id: typedId }).catch(() => setStartFailed(true))
  }

  // Auto-start on first entry, same discipline as the audit stage: the ref
  // stops re-render double-fires; the server's idempotent claim collapses
  // refreshes and concurrent triggers.
  useEffect(() => {
    if (!practice || practice.blueprint || autoStartedRef.current) return
    autoStartedRef.current = true
    runBlueprint({ id: typedId }).catch(() => setStartFailed(true))
  }, [practice, runBlueprint, typedId])

  if (practice === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const prep = pack.prep
  if (prep.kind !== "blueprint") return null
  const copy = prep.copy

  if (!practice.context) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        Your brief hasn&apos;t been read yet.{" "}
        <Link
          href={`/simulation/${simulationId}/analyze`}
          className="focus-ring underline hover:text-accent-blue"
        >
          Back to the read
        </Link>
        .
      </p>
    )
  }

  const blueprint = practice.blueprint
  if (!blueprint || blueprint.status === "failed" || blueprint.status === "generating") {
    const failed = blueprint?.status === "failed" || startFailed
    return (
      <div>
        {failed ? (
          <>
            <StageKicker>{copy.kicker}</StageKicker>
            <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
              The blueprint hit a wall.
            </h1>
            <p role="alert" className="mt-3 max-w-[52ch] text-[13.5px] text-red-fg">
              {blueprint?.status === "failed"
                ? (blueprint.failureMessage ?? "Something went wrong.")
                : "Couldn't start the blueprint. Check your connection and try again."}
            </p>
            <div className="mt-6">
              <button type="button" onClick={handleRun} className={BTN_PRIMARY}>
                Retry the blueprint <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <WaitingScreen
            kicker={prep.wait.kicker}
            heading={prep.wait.heading(scopeText(practice.scope, pack.subjectField))}
            lead={prep.wait.lead}
            rows={prep.wait.rows}
            work={prep.wait.work}
            ticker={prep.wait.ticker}
            stepMs={prep.wait.stepMs}
          />
        )}
      </div>
    )
  }

  // One pass only: any refinement record — pending or completed — closes
  // the editing affordances for good.
  const locked = blueprint.refinement !== undefined
  const keptThemes = blueprint.themes.filter((theme) => !removed.includes(theme.title))
  const unanswered = blueprint.clarifyingQuestions.filter((entry) => !entry.answer)
  const hasEdits =
    removed.length > 0 ||
    redirectNote.trim().length > 0 ||
    unanswered.some((entry) => (answers[entry.question] ?? "").trim().length > 0)

  const handleToggleTheme = (title: string) => {
    if (locked) return
    setRemoved((current) =>
      current.includes(title)
        ? current.filter((entry) => entry !== title)
        : // The plan needs at least one theme; the server enforces it too.
          keptThemes.length > 1
          ? [...current, title]
          : current
    )
  }

  const handleRefine = async () => {
    if (submitting || !hasEdits) return
    setSubmitting(true)
    setRefineError(null)
    try {
      await requestRefinement({
        id: typedId,
        answers: unanswered
          .map((entry) => ({
            question: entry.question,
            answer: (answers[entry.question] ?? "").trim(),
          }))
          .filter((entry) => entry.answer.length > 0),
        removedThemes: removed,
        redirectNote: redirectNote.trim(),
      })
      setRemoved([])
      setRedirectNote("")
    } catch {
      setRefineError("That didn't go through. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <StageKicker>{copy.kicker}</StageKicker>
      <h1 className="max-w-[26ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
        {copy.readyHeading}
      </h1>
      <p className="mb-8 mt-2.5 max-w-[56ch] text-[14.5px] leading-relaxed text-on-surface-2">
        {locked
          ? "The plan is locked in. The questions stay sealed until the room."
          : copy.readyLead}
      </p>

      <section aria-label="Interview themes" className="mb-9">
        <h2 className="mb-3 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
          <span>What your interview will probe</span>
          <span className="font-mono text-[10.5px] tracking-[.02em]">
            {keptThemes.length} theme{keptThemes.length === 1 ? "" : "s"} · questions sealed
          </span>
        </h2>
        <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-2">
          {blueprint.themes.map((theme) => {
            const cut = removed.includes(theme.title)
            return (
              <li
                key={theme.title}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-raised p-4 shadow-card",
                  cut && "opacity-45"
                )}
              >
                <div>
                  <p
                    className={cn(
                      "text-[14px] font-semibold leading-[1.4]",
                      cut && "line-through decoration-ink-4"
                    )}
                  >
                    {theme.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-normal text-on-surface-2">
                    {theme.detail}
                  </p>
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => handleToggleTheme(theme.title)}
                    aria-pressed={cut}
                    aria-label={cut ? `Keep ${theme.title}` : `Remove ${theme.title}`}
                    className="focus-ring mt-0.5 flex-none rounded-md p-1 text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface"
                  >
                    {cut ? (
                      <Check className="size-[15px]" />
                    ) : (
                      <X className="size-[15px]" />
                    )}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {blueprint.clarifyingQuestions.length > 0 && (
        <section aria-label="Clarifying questions" className="mb-9">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
            Your interviewer asked
          </h2>
          <div className="space-y-3">
            {blueprint.clarifyingQuestions.map((entry) => (
              <div
                key={entry.question}
                className="rounded-xl border border-line bg-surface-raised p-4 shadow-card"
              >
                <p className="text-[13.5px] font-medium leading-normal">{entry.question}</p>
                {entry.answer ? (
                  <p className="mt-2 text-[13px] leading-normal text-on-surface-2">
                    <span aria-hidden="true" className="mr-1.5 font-mono text-ok">✓</span>
                    {entry.answer}
                  </p>
                ) : locked ? (
                  <p className="mt-2 text-[12.5px] text-on-surface-3">Left unanswered.</p>
                ) : (
                  <input
                    type="text"
                    value={answers[entry.question] ?? ""}
                    maxLength={ANSWER_CHARS}
                    placeholder="Answer inline — it sharpens the plan"
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [entry.question]: event.target.value,
                      }))
                    }
                    className={cn(FIELD_INPUT, "mt-2.5")}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!locked && (
        <section aria-label="Redirect the focus" className="mb-9 max-w-[560px]">
          <h2 className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
            <span>Redirect the focus</span>
            <span className="font-mono text-[10.5px] font-normal normal-case tracking-[.02em] text-ink-4">
              optional
            </span>
          </h2>
          <input
            type="text"
            value={redirectNote}
            maxLength={REDIRECT_NOTE_CHARS}
            placeholder='e.g. "less system design, more people management"'
            onChange={(event) => setRedirectNote(event.target.value)}
            className={FIELD_INPUT}
          />
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3.5">
        {!locked && (
          <button
            type="button"
            onClick={handleRefine}
            disabled={!hasEdits || submitting}
            className={cn(hasEdits ? BTN_PRIMARY : BTN_SECONDARY, "disabled:opacity-50")}
          >
            {submitting ? "Updating the plan" : "Update the plan"}
          </button>
        )}
        <Link
          href={`/simulation/${simulationId}/panel`}
          className={locked || !hasEdits ? BTN_PRIMARY : BTN_SECONDARY}
        >
          {copy.cta} <span aria-hidden="true">→</span>
        </Link>
        <span className="text-[12.5px] text-on-surface-3">
          {locked
            ? "One revision was the deal. See you in the room."
            : unanswered.length > 0
              ? "Unanswered questions are fine — they just leave the plan broader."
              : "One revision, then it locks."}
        </span>
      </div>

      {refineError && (
        <p role="alert" className="mt-5 text-[13px] text-red-fg">
          {refineError}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Branch the route**

Replace `src/app/(flow)/simulation/[id]/audit/page.tsx` with:

```tsx
"use client"

import { use } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AuditStage } from "@/components/simulation/intake/AuditStage"
import { BlueprintStage } from "@/components/simulation/intake/BlueprintStage"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// One route, two prep stages: the practice's pack declares whether its
// middle beat is the claims audit or the interview blueprint.
const PrepPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const practice = useQuery(api.practices.get, { id: id as Id<"practices"> })
  return (
    <FlowShell stage="audit" simulationId={id}>
      {practice === undefined ? null : practice === null ? (
        <IdeaNotFound />
      ) : getPack(practice.packId).prep.kind === "blueprint" ? (
        <BlueprintStage simulationId={id} />
      ) : (
        <AuditStage simulationId={id} />
      )}
    </FlowShell>
  )
}

export default PrepPage
```

- [ ] **Step 3: Verify**

Run: `pnpm test` — Expected: PASS.
Run: `pnpm lint` — Expected: clean. Stop for review.

---

### Task 10: Full verification and the developer's launch checklist

**Files:**
- No new code. This task proves the whole lane and hands off the manual steps.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS — including `blueprint.test.ts`, `registry.test.ts`, `interview/prompts.test.ts`, `interview/briefing.test.ts`, extended `debrief.test.ts`, and all pre-existing tests.

- [ ] **Step 2: Types and build (the spec's type-level test)**

Run: `npx convex codegen && pnpm build`
Expected: clean build — this is the proof that all four packs compile under the discriminated prep contract and that every engine touchpoint type-checks. Fix any errors before proceeding.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Write the launch checklist into the final report**

Do NOT run these — they hit the developer's Convex deployment and Clerk-authenticated app. Report them verbatim as the developer's post-review steps:

1. Push functions/schema to the dev deployment (`npx convex dev` picks it up automatically).
2. Register the three avatars (validated against the registry, so it must happen after deploy):
   ```
   npx convex run avatars:register '{"packId":"interview","personaId":"screener-01","runwayAvatarId":"e4da878f-8d71-430b-bf90-5bd17745922f"}'
   npx convex run avatars:register '{"packId":"interview","personaId":"hm-01","runwayAvatarId":"5d44147b-82ab-40be-a863-ffafcfebe138"}'
   npx convex run avatars:register '{"packId":"interview","personaId":"practitioner-01","runwayAvatarId":"a0b8290c-d07e-4582-916d-f81041378728"}'
   ```
   Until this runs, entering an interview room fails with "No avatar registered for this panelist" — expected, by design.
3. Smoke-test the lane end-to-end: enable the Interview lane (welcome/settings), create a practice with a pasted JD + uploaded resume PDF, watch Read → Blueprint (themes visible, remove one, answer a clarifying question, one refinement, lock), Panel (recommendation follows interview type), Room (interviewer works the plan; regulated-context practice never asserts rules), End session → debrief (verdict pill reads "Would move you forward" / "On the fence" / "Wouldn't advance you yet"; a Georgia-insurance-style run shows the "Verify before the real thing" section).
4. Review the diff and commit — the developer only.

- [ ] **Step 5: Stop**

Leave everything uncommitted. Summarize what was built, what the tests prove, and the checklist above.

---

## Self-Review (completed at plan time)

- **Spec coverage:** pack-driven prep discrimination → Tasks 2/7/9; honest scoping → Tasks 5/6 (prompt backstop + briefing section + verifyItems); themes visible/questions sealed → Tasks 1/8/9 (sealed fields stored, never rendered); cast of three + registration → Tasks 4/10; debrief shape + `verifyItems`, no numeric scoring → Task 3; intake fields incl. voice extraction → Tasks 5/7; blueprint action with claim/idempotency + failure handling → Tasks 1/8; briefing budget/priorities → Task 6; orchestrator theme tracking → Tasks 5/8; verdict vocabulary → Task 7 (value renamed `move-forward` for cross-pack distinctness — see Global Constraints); `controlArea` → `sessionMetaField` → Task 2; `focusAreas` heuristic-for-free → Task 7 (field key) + Task 2 (hook ordering keeps the heuristic as fallback); `openQuestions` in contextFields → Task 7; missing-avatar error surfacing → already engine behavior, verified in Task 10; all four spec test groups → Tasks 1, 3, 6, 10(build).
- **Out of scope honored:** no web research, no per-question ratings, no multi-round programs, no company impersonation.
- **Type consistency spot-checks:** `prep.stepLabel`/`prep.wait`/`prep.copy` names used identically in Tasks 2, 7, 9; `blueprints.run`/`requestRefinement` names match between Tasks 8 and 9; `ParsedBlueprint` spread into `setOutcome`'s ready outcome matches its validator fields; `refineBlueprint` is the pack's `prep.refine`; `verifyItems` flows `parseDebrief` → `setDebrief` → schema optional → UI optional read.
