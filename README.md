# Redline

Pre-diligence for a startup idea, before a real investor runs it for you. A founder pitches out loud, an AI panel reads their deck, finds the gaps an investor will find, interrogates them live on the weakest one, and hands back a scored verdict with a fix list.

## How it works

Six stages, each building on the last:

1. **Brief** the founder speaks or uploads a deck; the idea assembles itself from what they gave.
2. **Read** materials are extracted with page, slide, and sheet markers so every later claim can cite its source.
3. **Audit** the panel reads the materials and separates what is supported from what is only asserted.
4. **Panel** the weakest axis is chosen, and the panelist who owns it is picked to run the room.
5. **Room** a live, photoreal investor interrogates the founder out loud on that weakness.
6. **Verdict** a scored readout with the panelist's spoken verdict, the risks, and a seven-day fix list.

## The Runway integration

The live interrogator is a **Runway Character**: a realtime, photoreal avatar that hears the founder speak and pushes back in the moment, in its own voice. The founder is across the table from an investor, not a chat box.

The verdict is delivered by that same investor: the delivering panelist's one-line spoken verdict is quoted over a composed three-person panel tableau with their seat lit, so the verdict comes from the same face that ran the interrogation.

If you build on the avatars SDK, [docs/runway-avatar-findings.md](docs/runway-avatar-findings.md) collects a few non-obvious behaviors we hit, each with a source citation and the workaround.

## The grounding architecture

The core of this repo is a rule the product enforces on itself: it does not make things up.

A finding cannot exist without evidence, and that rule lives in the type, not in a prompt. A `Claim` is a value that carries a `citation`; there is no shape for a claim without one, so an ungrounded assertion cannot be constructed in the first place, only demoted to a flagged gap. The report's "held up" findings work the same way: `groundHeldUp` keeps a finding only if its quote appears verbatim in the founder's actual speech (normalized for case and punctuation, never for paraphrase). Intake fills only the fields it actually heard and flags the rest.

The pattern is "make invalid states unrepresentable," applied to model output. Fabrication is not discouraged with instructions; it is unrepresentable in the data model. A founder who said nothing defensible gets a report that says nothing held up, honestly, rather than an invented compliment.

The same discipline shapes the live experience. The founder's speech was transcribed in six-second batches; it now streams word by word, browser-direct through AssemblyAI, so the panel reacts to what is being said as it is said.

## Stack

Next.js and Convex (database, server functions, realtime), Runway (Characters), AssemblyAI streaming transcription, OpenAI for orchestration and the written report.

## Setup

```bash
pnpm install
npx convex dev        # provisions the backend, watches functions
pnpm dev              # http://localhost:3000
```

In `.env.local` (read by the Next server and the client build):

- `RUNWAYML_API_SECRET`, `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`
- `NEXT_PUBLIC_RUNWAY_AVATAR_VC`, `NEXT_PUBLIC_RUNWAY_AVATAR_CUSTOMER`, `NEXT_PUBLIC_RUNWAY_AVATAR_TECH` (the three avatar ids)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` (Clerk auth)

In the Convex deployment, set with `npx convex env set NAME value` (read by Convex actions):

- `RUNWAYML_API_SECRET`, `OPENAI_API_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`: the Clerk instance's issuer URL (`https://….clerk.accounts.dev`). Convex validates the session JWT against it; also create a JWT template named `convex` in the Clerk dashboard.
- `OPENAI_MODEL_FAST`, `OPENAI_MODEL_QUALITY` (optional): model overrides, defaulting to `gpt-4o-mini`. Convex actions read the deployment env, not `.env.local` — a model set only locally never reaches them.

`npx convex dev` writes `NEXT_PUBLIC_CONVEX_URL` for you.

Auth is Clerk, invite-only: sign-up is Restricted in the Clerk dashboard, and testers are added under Users → Invitations. Sign-in is Google or an email code at `/sign-in`. Every page, API route, and public Convex function requires a session, and each user sees only their own ideas, sessions, and verdicts.
