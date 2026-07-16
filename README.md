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

The verdict is delivered by that same investor. **Act-Two** drives a composed three-person boardroom still with the delivering panelist's **avatar video**, so the panel appears together in one shot and the verdict comes from the same face and voice that ran the interrogation. One panelist speaks; the other two sit with them.

If you build on the avatars SDK, [docs/runway-avatar-findings.md](docs/runway-avatar-findings.md) collects a few non-obvious behaviors we hit, each with a source citation and the workaround.

## The grounding architecture

The core of this repo is a rule the product enforces on itself: it does not make things up.

A finding cannot exist without evidence, and that rule lives in the type, not in a prompt. A `Claim` is a value that carries a `citation`; there is no shape for a claim without one, so an ungrounded assertion cannot be constructed in the first place, only demoted to a flagged gap. The report's "held up" findings work the same way: `groundHeldUp` keeps a finding only if its quote appears verbatim in the founder's actual speech (normalized for case and punctuation, never for paraphrase). Intake fills only the fields it actually heard and flags the rest.

The pattern is "make invalid states unrepresentable," applied to model output. Fabrication is not discouraged with instructions; it is unrepresentable in the data model. A founder who said nothing defensible gets a report that says nothing held up, honestly, rather than an invented compliment.

The same discipline shapes the live experience. The founder's speech was transcribed in six-second batches; it now streams word by word, browser-direct through AssemblyAI, so the panel reacts to what is being said as it is said.

## Stack

Next.js and Convex (database, server functions, realtime), Runway (Characters, avatar videos, Act-Two), AssemblyAI streaming transcription, OpenAI for orchestration and the written report.

## Setup

```bash
pnpm install
npx convex dev        # provisions the backend, watches functions
pnpm dev              # http://localhost:3000
```

Set these in the Convex deployment and `.env.local`: `RUNWAYML_API_SECRET`, `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`, and the three avatar ids (`NEXT_PUBLIC_RUNWAY_AVATAR_VC`, `_CUSTOMER`, `_TECH`). No auth; this is a single-user demo.
