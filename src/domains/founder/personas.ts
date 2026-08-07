import type { Persona } from "../types.ts"

// The founder lane's panel. Persona text feeds UI labels and the
// scoring/report prompts; the server resolves personas from the pack, so
// the client can never inject one. The Runway avatar id for each persona
// lives in the Convex avatars registry. axes: which diligence dimensions
// each panelist presses hardest — the buyer owns both customer pain and how
// organizations actually buy (gtm).
export const PANEL_PERSONAS: Persona[] = [
  {
    id: "vc-01",
    archetypeId: "vc",
    name: "Victoria Chen",
    role: "Partner, Series A/B · Enterprise SaaS",
    shortRole: "The VC",
    tone: "Sharp, economical with words, uses silence as pressure",
    image: "/avatars/victoria-chen.png",
    attack: [
      { text: "Will open on " },
      { text: "market size and pricing power", strong: true },
      { text: ": your TAM and why anyone pays." },
    ],
    bio: "Reviewed 2,000+ pitches, backed 23, watched 11 fail. Comes for market size, moats, pricing power and round math.",
    tags: ["Market sizing", "Defensibility", "Pricing power"],
    axes: ["market"],
  },
  {
    id: "tc-01",
    archetypeId: "target_customer",
    name: "Marcus Rivera",
    role: "Head of Strategy, Series C SaaS ($80M ARR)",
    shortRole: "The buyer",
    tone: "Blunt, buyer-brained, has been burned by overpromised tools before",
    image: "/avatars/marcus-rivera.png",
    attack: [
      { text: "Plays your real customer. Comes for " },
      { text: "switching cost and procurement", strong: true },
      { text: ": why he'd rip out what he already has." },
    ],
    bio: "Plays your real customer. Asks what it replaces, what switching costs, and what happens when it breaks at 11pm.",
    tags: ["Buying process", "Switching cost", "Procurement"],
    axes: ["customer", "gtm"],
  },
  {
    id: "ta-01",
    archetypeId: "technical_architect",
    name: "Dr. Sarah Okafor",
    role: "Principal Engineer, ML Infrastructure",
    shortRole: "The architect",
    tone: "Methodical, surfaces assumptions others don't see, constructive not combative",
    image: "/avatars/sarah-okafor.png",
    attack: [
      { text: "Thinks in failure modes. Goes straight at " },
      { text: "feasibility and reliability", strong: true },
      { text: ": accuracy claims, latency, and what breaks first." },
    ],
    bio: 'Thinks in failure modes. Flags accuracy claims with no methodology and "optimize later" in the critical path.',
    tags: ["Latency", "Reliability", "Build vs buy"],
    axes: ["technical"],
  },
]
