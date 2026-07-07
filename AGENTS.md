# Redline — Project Context

## What This Is
AI panel simulation. Users stress-test ideas against 3 live Runway avatar
characters (VC, Target Customer, Technical Architect).
Flow: Brief → Analysis → Panel → Live Room → Verdict → Report with
Runway-generated videos.

## Stack
Next.js 16.2, TypeScript strict, Tailwind CSS v4, shadcn/ui, Convex,
OpenAI SDK, @runwayml/avatars-react, @runwayml/sdk, pnpm

## Critical: Tailwind v4
NO tailwind.config.ts — it does not exist in this project.
All theme config lives in src/app/globals.css inside @theme blocks.
Use CSS custom properties: var(--color-primary), var(--font-display) etc.

## Key Decisions
- Convex handles database, server functions, and real-time updates
- OpenAI: gpt-4o-mini for orchestration, gpt-4o for analysis and report
- Runway GWM Avatars: 3 simultaneous AvatarProvider sessions
- No auth — single user demo for hackathon
- useQuery/useMutation/useAction from convex/react for all data

## Code Rules
- DRY — no repeated logic
- Early returns always
- Handle prefix on all event handlers (handleClick, handleSubmit)
- Const arrow functions only
- No semicolons
- Tailwind utility classes only — no inline styles, no CSS modules
- No tailwind.config.ts — configure theme in globals.css @theme
- Zod for all external data validation
- All external API calls in /convex/ actions or /api/ route handlers only

## Do Not
- Create tailwind.config.ts — Tailwind v4 uses CSS-first config
- Add auth
- Over-engineer
- Leave TODOs or placeholders
- Use useState for data that belongs in Convex
- Auto-commit — developer reviews and commits all changes manually
