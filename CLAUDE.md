# Redline — Project Context

## What This Is
An AI panel stress test. A founder pitches an idea and is interrogated by 3
live Runway avatar characters (VC, Target Customer, Technical Architect).
Flow: Brief → Read → Audit → Panel → Room → Verdict, ending in a scored
report with the panelist's spoken verdict.

## Stack
Next.js 16.2, TypeScript strict, Tailwind CSS v4, shadcn/ui, Convex,
OpenAI SDK, @runwayml/avatars-react, @runwayml/sdk, pnpm

## Critical: Tailwind v4
NO tailwind.config.ts — it does not exist in this project.
All theme config lives in src/app/globals.css inside @theme blocks.
Use CSS custom properties: var(--color-primary), var(--font-display) etc.

## Key Decisions
- Convex handles database, server functions, and real-time updates
- OpenAI: gpt-4o-mini by default everywhere; OPENAI_MODEL_FAST (orchestration)
  and OPENAI_MODEL_QUALITY (audit, report) override it — set them in the
  Convex deployment env, which actions read (not .env.local)
- Runway GWM Avatars: 3 simultaneous AvatarProvider sessions
- Clerk auth, invite-only (Restricted mode): Google + email sign-in. Every
  public Convex function calls requireIdentity (convex/guard.ts); Next
  middleware (src/proxy.ts) gates pages and API routes
- Data is scoped per user: ideas/simulations/rooms/reports carry the Clerk
  userId, list queries filter by_user, single-doc reads go through
  ownedOrNull (someone else's doc reads as missing). Audits/materials
  inherit ownership from their simulation
- useQuery/useMutation/useAction from convex/react for all data

## Code Rules
Full engineering standards, how this codebase is written and reviewed, live in
[docs/engineering-standards.md](docs/engineering-standards.md). Project-specific
conventions on top of those:
- No semicolons
- Const arrow functions only; Handle prefix on event handlers (handleClick, handleSubmit)
- Early returns over nested conditionals
- Tailwind utility classes only, no inline styles or CSS modules
- No tailwind.config.ts; theme lives in globals.css @theme
- Zod for external data validation
- All external API calls in /convex/ actions or /api/ route handlers only

## Do Not
- Create tailwind.config.ts (Tailwind v4 uses CSS-first config)
- Add a public Convex function or API route without an identity check
- Leave TODOs or placeholders
- Use useState for data that belongs in Convex
- Commit. Ever. The developer is the only one who commits, after reviewing
  the diff. No git add/commit/stash workarounds; leave work uncommitted in
  the tree and stop for review.
