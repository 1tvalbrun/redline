# Interview prep lane — design

Date: 2026-08-17. Status: approved in conversation, pending spec review.

## What this is

A fourth DomainPack, `interview`, that lets a user practice a job interview
for any role: engineering manager behavioral loops, React technical
deep-dives, customer service, nursing, licensed insurance sales. Unlike the
existing lanes, the domain is unknown until intake, so the lane's credibility
comes from a prep step: the system builds a role-specific interview blueprint
before the room, and the avatar interviews from that vetted plan instead of
improvising domain facts live.

## Locked decisions

- **Approach: pack-driven prep stage.** The engine gains one narrow
  capability: a pack declares whether its middle stage is the existing claims
  Audit or the new Blueprint stage. No generic `pack.stages` machinery.
- **Honest scoping for regulated domains.** The interviewer never asserts
  regulatory facts (statutes, state rules, licensing or exam content) as
  ground truth, in any lane state. It probes how the candidate reasons and
  how they would verify, and the debrief lists verify-with-official-sources
  items. No web research dependency, no curated vertical content.
- **Themes visible, questions sealed.** The blueprint stage shows the user
  the shape of the interview and lets them redirect focus; the actual
  questions stay sealed until the room.
- **Cast of three, specialized by interview format, not domain.** Formats are
  few and stable; domains are infinite. The Runway-stored personality carries
  a timeless interviewing temperament; the per-session briefing carries
  everything domain-specific.
- **Feedback keeps the existing debrief shape** plus one optional
  `verifyItems` list. No numeric scoring (deliberately removed product-wide
  in the 2026-08-09 redesign; stays removed).

## Cast and Runway assets

Runway Characters already created by the developer (portraits, personalities,
and voices done in Runway):

| Persona id | Name | Archetype | Voice | Runway avatar id |
| --- | --- | --- | --- | --- |
| `screener-01` | Jun Park | Recruiter screen: motivation, career story, fit, fast pace | Zach (Casual) | `e4da878f-8d71-430b-bf90-5bd17745922f` |
| `hm-01` | Renee Calloway | Behavioral: stories, ownership, conflict, three-levels-deep follow-up | Nina (Smooth), fallback Petra | `5d44147b-82ab-40be-a863-ffafcfebe138` |
| `practitioner-01` | Tomás Reyes | Domain deep-dive: scenarios, why-chains, trade-off pressure | Vincent (Knowledgeable) | `a0b8290c-d07e-4582-916d-f81041378728` |

Stored personalities are domain-blind. Each states that the role, candidate
background, and question plan arrive in the session briefing, and each
carries a permanent honest-scoping backstop (never assert laws, licensing
rules, or exam content; ask how the candidate would verify). Jun is capped at
3 sentences per turn (screens are fast), Renee and Tomás at 4.

Registration happens after the pack skeleton exists (`avatars:register`
validates pack and persona ids against the registry):

```
npx convex run avatars:register '{"packId":"interview","personaId":"screener-01","runwayAvatarId":"e4da878f-8d71-430b-bf90-5bd17745922f"}'
npx convex run avatars:register '{"packId":"interview","personaId":"hm-01","runwayAvatarId":"5d44147b-82ab-40be-a863-ffafcfebe138"}'
npx convex run avatars:register '{"packId":"interview","personaId":"practitioner-01","runwayAvatarId":"a0b8290c-d07e-4582-916d-f81041378728"}'
```

Portraits also land in `public/avatars/` for the persona cards.

## Intake (pack.scopeFields)

Only the role is required; everything else sharpens the blueprint.

| Field | Kind | Required | Notes |
| --- | --- | --- | --- |
| `roleTitle` | text | yes | The pack's `subjectField`; names the practice. "Engineering Manager, frontend teams" |
| `interviewType` | chip | no, defaults Mixed | Screening call / Behavioral / Technical & scenarios / Full loop (mixed). Drives the recommended persona: Jun / Renee / Tomás / Renee |
| `seniority` | chip | no | Entry / Mid / Senior / Leadership. Calibrates difficulty and strategic-vs-hands-on pressure |
| `industryContext` | text | no | "regional hospital ICU", "B2B SaaS startup", "state-licensed health insurance sales in Georgia". Primary signal for regulated-territory detection |
| `focusAreas` | multi | no | "Where do you want the pressure?" Named `focusAreas` on purpose: the engine's persona-recommendation heuristic matches on that key |
| `jobPosting` | long text | no | Pasted JD for users who don't have a file |

Job posting and resume can also be uploaded as files through the existing
materials pipeline (extraction already works). The JD teaches the blueprint
the company's actual language; the resume plants "I see you led X, tell me
about that" hooks.

Voice intake works unchanged: the pack's `extractScope` prompt pulls these
fields from a spoken description. Chip extraction returns labels, not values,
matching the other lanes.

The form deliberately stays short. The safety net for "did we collect
enough?" is the blueprint stage's clarifying questions, which ask only for
load-bearing missing info after the model has seen the role.

## Pack contract change

`DomainPack` becomes discriminated on its prep stage:

- Existing packs: `prep: { kind: "audit", prompt: <current audit prompt> }`
- Interview pack: `prep: { kind: "blueprint", prompt: <blueprint prompt> }`

`prompts.audit` moves out of the always-required prompt set into the audit
arm, so an interview pack cannot carry a dangling audit prompt and an audit
pack cannot omit one. All four packs must compile under the new contract.

Engine consequences, kept minimal:

- The `/audit` route renders `AuditStage` or the new `BlueprintStage` based
  on the practice's pack.
- FlowShell's step label for the middle beat ("Pre-read" today) comes from
  pack copy instead of the hardcoded constant.
- `AnalysisPipeline`'s unconditional redirect to `/audit` stays; the route
  itself branches.

## Blueprint stage

New Convex action `generateBlueprint` (quality model tier), mirroring
`runAudit`'s claim/idempotency pattern so concurrent triggers collapse.
Input: scope plus extracted materials. Output validated and capped before
storage; bad model output becomes `failed` status with a fixed user-facing
message and a retry, never a broken screen or provider error text.

Blueprint shape (stored on the practice):

- **themes** (max 6, visible): title plus one line on what will be probed and
  why it is real for this role and level.
- **clarifyingQuestions** (max 3, visible, often zero): asked only when
  something load-bearing is missing (which state, license type, IC-vs-manager
  track). The user answers inline on the blueprint screen; answers trigger
  exactly one refinement pass, then refinement closes. Answers are clamped
  like other user text.
- **questionPlan** (sealed): per-theme questions with intended follow-up
  angles. Stored server-side on the practice; the client never renders it. A
  user reading the network response could see it; they would only spoil their
  own practice. Accepted.
- **rubric** (sealed): what strong and weak answers look like per theme.
  Feeds both the room briefing and the debrief prompt, so feedback traces to
  pre-declared criteria.
- **verifyTopics**: populated when the role or industry touches licensed or
  regulated territory. Hardens the honest-scoping section of the briefing and
  seeds the debrief's verify items.

Stage UX: themes render as the visible "what your interviewer prepared"
read. Before locking in, the user can remove themes they don't want, add one
optional free-text redirect note ("less system design, more people
management"), and answer any clarifying questions; all of it feeds the
single refinement pass. Status is `awaiting-input` when unanswered
clarifying questions exist, otherwise `ready` directly; after refinement it
returns to `ready`. Lock-in advances to the Panel stage, where the
persona recommended by `interviewType` is preselected and overridable, same
as the founder lane's picker.

## Room briefing (`src/domains/interview/briefing.ts`)

Composed within the existing preamble budget (4k chars), sections dropping
whole in priority order:

1. Turn-taking contract (engine standard).
2. Role framing: "you are interviewing a candidate for {role} at {seniority}
   in {industry}", persona-appropriate.
3. Compressed question plan for this session.
4. Candidate hooks from the resume, when provided.
5. Honest-scoping guardrail restated with the specific `verifyTopics`.
6. Standard cases every lane handles: resume mid-session (6-turn digest, no
   reintroduction), continuity (open action items feed the start script),
   cold start.

The stored personality is appended after the preamble, as the engine already
does, so the temperament survives even if briefing sections get dropped by
the budget trimmer.

## Orchestrator and debrief

- `prompts.orchestrate`: live notes tuned to interviews; tracks which themes
  have been covered and nudges pacing. Includes the note-calibration contract
  the other lanes carry.
- `prompts.debrief`: receives the rubric alongside the transcript. The
  engine's feedback-integrity guardrails apply unchanged: verbatim quote
  grounding for held-up items, the sub-20-word participation floor forcing
  the lowest verdict, and the CALIBRATION contract.
- Verdicts: `advance` ("Would move you forward", tone good), `on-the-fence`
  (mid, fallback), `not-yet` ("Wouldn't advance you yet", bad).
- `debriefValidator` gains one optional field: `verifyItems: [{ text }]`,
  for example "Confirm Georgia's licensing requirements on X with the state
  board". The debrief UI renders it as its own section, visually distinct
  from "didn't hold": one means you answered weakly, the other means the
  interviewer could not vouch for a fact. Existing debriefs without the field
  remain valid; no migration.

## Data model

- `practices.blueprint` (optional field; only this lane writes it):
  `{ status: "generating" | "awaiting-input" | "ready" | "failed", themes,
  clarifyingQuestions (with answers), questionPlan, rubric, verifyTopics,
  failureMessage? }` with validators enforcing the caps. No new tables, no
  new indexes: every read path already fetches the practice document through
  `ownedOrNull`, so ownership and fail-closed behavior are inherited.
- `debriefValidator`: optional `verifyItems` array as above.

## Engine touchpoints beyond the prep discrimination

- The session-meta scope key hardcoded as `controlArea` in `RoomPage` and
  `PanelSetup` becomes pack-supplied (with the current value as each existing
  pack's setting), so this lane's focus surfaces without leaking audit
  vocabulary into engine code.
- `focusAreas` persona matching works for free because the intake field uses
  that exact key.
- The practice detail page's "still unproven" rail reads
  `context.openQuestions`; the interview pack's `contextFields` therefore
  include `openQuestions` alongside its role-summary fields so the Read stage
  and detail page populate.

## Error handling

- Blueprint generation failure: `failed` status, fixed user-facing message,
  retry button. Same pattern as audit failures; provider error text never
  reaches the client.
- `practices.analyze` still throws when the fast model omits a context
  field; the interview pack keeps `contextFields` few and concrete to stay
  robust on the fast tier.
- Clarifying-question answers validated and clamped server-side like all
  scope text.
- Missing avatar registration surfaces at session creation ("No avatar
  registered for this panelist"); registration is a setup-checklist step in
  the implementation plan.

## Tests

- Blueprint parsing: caps enforced, malformed output rejected to `failed`,
  regulated flagging populates `verifyTopics`, clarifying-answer refinement
  happens once.
- Briefing composition: sections drop whole in priority order under budget
  pressure; honest-scoping section survives whenever `verifyTopics` is
  non-empty (priority above resume hooks).
- Debrief parsing: `verifyItems` accepted when present, absent field valid,
  verdict vocabulary enforced with fallback.
- Type-level: all four packs compile under the discriminated prep contract.

## Out of scope

- Web-research grounding and curated vertical content (revisit only if
  honest scoping proves insufficient in real use).
- Per-question ratings or STAR-scored feedback.
- Multi-round programs (screen, then behavioral, then technical as one
  tracked loop); continuity already gives lightweight cross-session memory.
- Company-specific interviewer impersonation ("interview me as Google").
