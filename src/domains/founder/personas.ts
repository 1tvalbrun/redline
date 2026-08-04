import type { Persona } from "../types.ts"

// The founder lane's panel. Persona text feeds UI labels and the
// scoring/report prompts; the server resolves personas from the pack, so
// the client can never inject one. The Runway avatar id for each persona
// lives in the Convex avatars registry.
export const PANEL_PERSONAS: Persona[] = [
  {
    id: "vc-01",
    archetypeId: "vc",
    name: "Victoria Chen",
    role: "Partner, Series A/B · Enterprise SaaS",
    tone: "Sharp, economical with words, uses silence as pressure",
  },
  {
    id: "tc-01",
    archetypeId: "target_customer",
    name: "Marcus Rivera",
    role: "Head of Strategy, Series C SaaS ($80M ARR)",
    tone: "Blunt, buyer-brained, has been burned by overpromised tools before",
  },
  {
    id: "ta-01",
    archetypeId: "technical_architect",
    name: "Dr. Sarah Okafor",
    role: "Principal Engineer, ML Infrastructure",
    tone: "Methodical, surfaces assumptions others don't see, constructive not combative",
  },
]
