# Redesign Stage 1 — Skin (fonts, tokens, theming, primitives) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire app to the mock design system — new fonts, light+dark palette, soft radii, restyled chrome — with zero structural or data changes.

**Architecture:** Re-point the existing design tokens (`--surface`, `--on-surface`, `--line`, …) at the mock palette so every component picks up the new look without renaming classes; add new tokens (blue accent, lane colors, warn/ok, shadows); swap the three font families; mount `next-themes` for light/dark; restyle the shared chrome (rail, topbar, flow header, wait screen, CTAs, Panel).

**Tech Stack:** Next.js 16 App Router, Tailwind v4 CSS-first (`@theme` in `src/app/globals.css`, NO tailwind.config.ts), next-themes (already a dep), next/font/google.

**Spec:** `docs/superpowers/specs/2026-08-09-practice-redesign-design.md`. Visual source of truth: `public/design-reference/*.html`.

## Global Constraints

- **NEVER commit.** The developer reviews in-app and commits personally at the stage gate. Leave all work uncommitted.
- No semicolons; const arrow functions; `Handle` prefix on event handlers; early returns.
- Tailwind utilities only — no inline styles, no CSS modules, no tailwind.config.ts.
- No TODOs or placeholders in shipped code.
- Stage 1 must not change routes, Convex schema/functions, or component structure — skin only. Old pages keep working.
- Verification per task: `pnpm lint` and `pnpm build` pass; visual check happens at the stage gate by the developer.

---

### Task 1: Fonts

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (font vars in `@theme inline`)

**Interfaces:**
- Produces: CSS vars `--font-instrument`, `--font-source-serif`, `--font-spline-mono` on `<html>`; theme fonts `--font-sans`, `--font-serif`, `--font-mono`, `--font-display` (alias of sans so existing `font-display` usages keep rendering).

- [ ] **Step 1: Swap font imports in `src/app/layout.tsx`**

```tsx
import { Instrument_Sans, Source_Serif_4, Spline_Sans_Mono } from "next/font/google"

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-source-serif",
})

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-spline-mono",
})
```

Apply `${instrumentSans.variable} ${sourceSerif.variable} ${splineMono.variable}` on `<html>`, remove Archivo/IBM Plex. Add `suppressHydrationWarning` to `<html>` (needed by Task 3's ThemeProvider). Update `metadata` to `title: "Redline · Practice with a live AI panel"`, `description: "Practice your pitch, sale, or audit interview live with an AI avatar — leave with feedback and action items."`

- [ ] **Step 2: Re-point font tokens in `globals.css` `@theme inline`**

```css
--font-sans: var(--font-instrument);
--font-serif: var(--font-source-serif);
--font-mono: var(--font-spline-mono);
--font-display: var(--font-instrument);
```

Delete `--font-display--font-variation-settings`.

- [ ] **Step 3: Verify** — `pnpm lint && pnpm build` pass.

### Task 2: Palette tokens, radius, texture kill

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces (new utilities available everywhere): colors `accent-bg`, `accent-line`, `lane-founder(-bg/-line)`, `lane-sales(-bg/-line)`, `lane-audit(-bg/-line)`, `warn(-bg/-line)`, `ok-bg`, `ink-4`; shadows `shadow-btn`, `shadow-card`. Existing names (`surface*`, `on-surface*`, `line*`, `red*`, `ok`, `amber*`) keep working, re-pointed to mock values.

- [ ] **Step 1: Replace `:root` primitives with the mock light palette**

```css
:root {
  --surface: #f7f8fa;         /* paper */
  --surface-2: #f1f4f8;       /* hover */
  --surface-3: #e8edf3;       /* press */
  --surface-raised: #ffffff;  /* card */
  --surface-rail: #ffffff;    /* panel/sidebar */
  --on-surface: #151a21;      /* ink */
  --on-surface-2: #4e5866;
  --on-surface-3: #818b98;
  --ink-4: #b4bcc7;
  --line: #e5e9ee;
  --line-2: #d6dce4;
  --red: #c93a26;             /* brand mark only */
  --red-deep: #a82d1c;
  --red-fg: #c93a26;
  --accent-blue: #0e5fd8;
  --accent-blue-hover: #0b4fb6;
  --accent-bg: #e8f0fc;
  --accent-line: #c4d9f6;
  --lane-founder: #5348b8; --lane-founder-bg: #ecebfa; --lane-founder-line: #d9d6f3;
  --lane-sales: #0e6e55;   --lane-sales-bg: #e6f2ec;   --lane-sales-line: #cce4d8;
  --lane-audit: #b04a28;   --lane-audit-bg: #f6ebe4;   --lane-audit-line: #ead3c5;
  --ok: #3d7a32; --ok-fg: #3d7a32; --ok-bg: #eaf2e4;
  --amber: #8a5a12; --amber-fg: #8a5a12;
  --warn: #8a5a12; --warn-bg: #f6eedb; --warn-line: #e9d9b6;
  --shadow-btn-value: 0 1px 2px rgba(21, 26, 33, 0.13);
  --shadow-card-value: 0 1px 3px rgba(21, 26, 33, 0.06);
  --radius: 0.875rem; /* lg = 14px cards; md ≈ 11px inputs; buttons use rounded-[10px] */
  /* shadcn semantics */
  --background: var(--surface);
  --foreground: var(--on-surface);
  --card: var(--surface-raised);
  --card-foreground: var(--on-surface);
  --popover: var(--surface-raised);
  --popover-foreground: var(--on-surface);
  --primary: var(--accent-blue);
  --primary-foreground: #ffffff;
  --secondary: var(--surface-2);
  --secondary-foreground: var(--on-surface);
  --muted: var(--surface-2);
  --muted-foreground: var(--on-surface-2);
  --accent: var(--surface-2);
  --accent-foreground: var(--on-surface);
  --destructive: var(--red);
  --destructive-foreground: #ffffff;
  --border: var(--line);
  --input: var(--line-2);
  --ring: var(--accent-blue);
  /* sidebar semantics point at panel white */
  --sidebar: var(--surface-rail);
  --sidebar-border: var(--line);
  /* … keep remaining sidebar vars, re-pointed to new primitives */
}
```

- [ ] **Step 2: Dark palette on `.dark` AND `[data-surface="dark"]`** (room subtree stays forced-dark before Stage 4 rebuilds it)

```css
.dark,
[data-surface="dark"] {
  --surface: #101418;
  --surface-2: #1c222a;      /* hover */
  --surface-3: #262d36;      /* press */
  --surface-raised: #171c22; /* card */
  --surface-rail: #0b0f13;   /* panel */
  --on-surface: #e7eaee;
  --on-surface-2: #a5adb8;
  --on-surface-3: #76808c;
  --ink-4: #4a5461;
  --line: #262d36;
  --line-2: #333c47;
  --red: #e05540; --red-deep: #c94734; --red-fg: #e05540;
  --accent-blue: #7fb0f9; --accent-blue-hover: #9cc3fb;
  --accent-bg: #152944; --accent-line: #2a4a74;
  --lane-founder: #a49af0; --lane-founder-bg: #211f31; --lane-founder-line: #37344f;
  --lane-sales: #6bbf9f;   --lane-sales-bg: #182a22;   --lane-sales-line: #27443a;
  --lane-audit: #e5906b;   --lane-audit-bg: #2e1f16;   --lane-audit-line: #463024;
  --ok: #8fbf7f; --ok-fg: #8fbf7f; --ok-bg: #22301d;
  --amber: #d9a853; --amber-fg: #d9a853;
  --warn: #d9a853; --warn-bg: #2c2515; --warn-line: #443921;
  --shadow-btn-value: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-card-value: 0 1px 3px rgba(0, 0, 0, 0.3);
  --primary-foreground: #0b1526; /* dark accent-blue is light — flip label */
}
```

- [ ] **Step 3: Register new tokens in `@theme inline`**

Add: `--color-ink-4`, `--color-accent-blue`, `--color-accent-blue-hover`, `--color-accent-bg`, `--color-accent-line`, `--color-lane-founder(-bg/-line)` ×3 lanes, `--color-warn(-bg/-line)`, `--color-ok-bg`, `--shadow-btn: var(--shadow-btn-value)`, `--shadow-card: var(--shadow-card-value)`, `--ease-brand` (keep). Keep `--animate-eq`, `--animate-blink`, `--animate-shimmer`, `--animate-ring` (used by wait screen/recorder/room); delete `--animate-pulse-red` and its keyframes only if `pnpm lint`-clean grep shows no remaining `animate-pulse-red` usage — otherwise leave for the Stage-4/6 sweep.

- [ ] **Step 4: Kill texture, fix selection/focus**

Delete the `body::after` film grain block and the `@utility grain-overlay` block if unused outside room (grep `grain-overlay`; room still uses it → keep the utility, delete only body grain). Replace `::selection` with `background: var(--accent-bg); color: var(--accent-blue-hover)`. `focus-ring` utility keeps `outline: 2px solid var(--ring)`.

- [ ] **Step 5: Verify** — `pnpm lint && pnpm build`; grep for `--font-archivo|--font-plex` returns nothing.

### Task 3: ThemeProvider + toggle

**Files:**
- Modify: `src/app/layout.tsx` (or `src/app/providers.tsx`)
- Create: `src/components/shared/ThemeToggle.tsx`
- Modify: `src/components/layout/AppRail.tsx` (mount toggle in footer)

**Interfaces:**
- Produces: `<ThemeToggle />` — icon button cycling light/dark (next-themes `useTheme`), safe for SSR (renders skeleton until mounted).

- [ ] **Step 1: Wrap the tree** with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` from `next-themes` (html already has `suppressHydrationWarning` from Task 1).

- [ ] **Step 2: `ThemeToggle`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) return <span className="size-8" />

  const isDark = resolvedTheme === "dark"
  const handleToggle = () => setTheme(isDark ? "light" : "dark")

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-8 place-items-center rounded-lg text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface-2 focus-ring"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
```

- [ ] **Step 3: Mount** in the AppRail footer next to the user chip.
- [ ] **Step 4: Verify** — build passes; toggling flips the palette; the Room subtree (`[data-surface="dark"]`) stays dark in both themes.

### Task 4: Primitives — buttons, Panel/card, badges

**Files:**
- Modify: `src/components/workspace/cta.ts` (`WORKSPACE_CTA`)
- Modify: `src/components/simulation/flow/FlowShell.tsx` (`FLOW_BTN`, `StageKicker`)
- Modify: `src/components/shared/Panel.tsx`
- Modify: `src/components/ui/button.tsx` (default variant → blue accent pill)
- Modify: `src/components/workspace/VerdictBadge.tsx`

**Interfaces:**
- Produces: `FLOW_BTN` / `WORKSPACE_CTA` class strings render the mock primary button (blue, `rounded-[10px]`, `shadow-btn`, 13.5px medium, hover `accent-blue-hover`, active scale .98); `Panel` renders the mock card (white bg, `border-line`, `rounded-xl`, `shadow-card`, uppercase 11px mono section title in `on-surface-3`).

- [ ] **Step 1: Primary CTA strings** — both scales become:

```
inline-flex items-center justify-center gap-2 rounded-[10px] bg-accent-blue px-[18px] py-2.5 text-[13.5px] font-medium text-white shadow-btn transition hover:bg-accent-blue-hover active:scale-[0.98] disabled:opacity-50 focus-ring
```

(dark-theme text stays legible via `--primary-foreground` where the shadcn Button is used; the raw strings hardcode white which is correct on light-blue only in light mode — use `text-primary-foreground` instead of `text-white` wherever the class string feeds a themed context)

Drop the mono/uppercase/red-hover treatment. Keep existing font-size hierarchy differences if any callers rely on them.

- [ ] **Step 2: `Panel.tsx`** — container: `rounded-xl border border-line bg-surface-raised shadow-card`; title row: `font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-on-surface-3`; body padding per current props.

- [ ] **Step 3: `button.tsx`** — default variant `bg-primary text-primary-foreground hover:bg-accent-blue-hover rounded-[10px] shadow-btn`; outline/ghost variants use `border-line-2`, `hover:bg-surface-2`. `VerdictBadge` → pill: `rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em]`, tone-mapped (ok → `bg-ok-bg text-ok`, warn → `bg-warn-bg text-warn border-warn-line`, bad → `bg-lane-audit-bg text-lane-audit border-lane-audit-line`).

- [ ] **Step 4: Verify** — `pnpm lint && pnpm build`.

### Task 5: Chrome restyle — rail, topbar, flow header, wait screen, splash

**Files:**
- Modify: `src/components/layout/AppRail.tsx`
- Modify: `src/app/(app)/layout.tsx` (topbar)
- Modify: `src/components/simulation/flow/FlowShell.tsx` (header/stepper)
- Modify: `src/components/simulation/flow/WaitingScreen.tsx` (skin only)
- Modify: `src/app/providers.tsx` (Splash)
- Modify: `src/app/welcome/page.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx` (palette-breaking hardcodes only)

**Interfaces:**
- Consumes: tokens from Task 2, fonts from Task 1, `ThemeToggle` from Task 3, CTA strings from Task 4.

- [ ] **Step 1: AppRail** — white panel `bg-surface-rail border-r border-line`, logo = 24px `rounded-[7px] bg-on-surface` mark with 12×3px `bg-red rounded-[2px]` bar + 15px semibold wordmark; "New run" button → mock `new-btn` (white card, `border-line-2`, `rounded-[10px]`, `shadow-btn`, kbd chip `font-mono text-[10.5px] border border-line-2 rounded-[5px] bg-surface px-1.5`); nav items → `rounded-[9px] px-2.5 py-[7px] text-[13.5px] text-on-surface-2 hover:bg-surface-2`, active = `bg-surface-raised border border-line font-medium text-on-surface shadow-btn` (no red bar); group heads → `font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-on-surface-3`; counts → `rounded-full bg-surface-3 text-on-surface-3 text-[11px] min-w-5 h-5 px-1.5`. Remove "System ready" dot + RailClock red styling (keep clock if it renders cleanly, else drop the row). Footer: user chip + `ThemeToggle`.
- [ ] **Step 2: Topbar** (`(app)/layout.tsx`) — `bg-surface/80 backdrop-blur border-b border-line`, breadcrumb `text-[13px] text-on-surface-2`, counters drop the ready-line framing (plain `font-mono text-[11px] text-on-surface-3` counts; the ready-line concept dies in Stage 2).
- [ ] **Step 3: FlowShell header** — `bg-surface-rail border-b border-line px-6 py-3.5`; logo per rail; stepper → `font-mono text-[11px] tracking-[0.04em] text-ink-4`, active `text-accent-blue`, done `text-on-surface-3`, 6px dot + 26px hairline dash between steps; "Save & exit" → `text-[13px] text-on-surface-3 rounded-lg px-2.5 py-1.5 hover:bg-surface-2`. `StageKicker` dot → `bg-accent-blue`.
- [ ] **Step 4: WaitingScreen** — structure/behavior untouched; swap surfaces (`bg-surface-raised`, `border-line`, `rounded-xl`, `shadow-card`), progress/ticker text to `font-mono text-on-surface-3`, any red accents → `accent-blue`.
- [ ] **Step 5: Splash + welcome/sign-in hardcodes** — Splash wordmark: `font-sans font-semibold tracking-[-0.02em]` on `bg-surface` (no grain, no Archivo width). Welcome: only palette fixes (red CTA → `FLOW_BTN`-style blue, square corners → rounded) — full rebuild is Stage 2. Sign-in: update Clerk appearance vars to `#0e5fd8` primary / `0.625rem` radius / new surface hexes.
- [ ] **Step 6: Full verify** — `pnpm lint && pnpm test && pnpm build` all pass; `rg "rounded-none|data-surface" src` reviewed (room keeps `data-surface`); dev-server walkthrough of `/`, `/ideas`, an idea detail, `/simulation/new`, a room page, `/welcome`, `/sign-in` in light and dark.

### Task 6: Stage gate

- [ ] Report to the developer: what changed, what to review in-app (both themes, all major pages), known holdovers (room/verdict pages still old-structure until Stages 4–5; welcome still old-structure until Stage 2). Developer reviews and commits. **Do not commit.**

---

## Later stages (planned at each gate)

Each subsequent stage gets its own plan file once the prior stage is approved, following the spec's stage table: Stage 2 (schema v2 + shell/Home/Welcome/practice detail), Stage 3 (wizard), Stage 4 (meet + room), Stage 5 (debrief + session page), Stage 6 (polish + sweep).

### Carry-overs from the Stage 1 review — REQUIRED in the Stage 2 plan

1. **Extract `LogoMark`** (`src/components/shared/LogoMark.tsx`, size prop only). The mark is hand-built in four places after Stage 1 — `AppRail.tsx`, `FlowShell.tsx`, `providers.tsx` (Splash), `sign-in/[[...sign-in]]/page.tsx` — and Stage 2 adds more (welcome, wizard header). Replace all four existing instances when the shell is rebuilt.
2. **Collapse `FLOW_BTN` + `WORKSPACE_CTA` into one shared primary-button constant** (they became the identical class string in Stage 1). `cta.ts`'s consumers are deleted in Stage 2, so do the collapse there: one exported constant (or the shadcn `Button`), zero duplicates left.
