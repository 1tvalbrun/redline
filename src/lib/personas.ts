// The panel roster shared by the client UI and Convex. Server-safe on
// purpose — no env reads, no images — because rooms.create resolves persona
// text here: the client names a persona, it never supplies one. The live
// avatar personality is stored on the Runway Character itself; these fields
// only feed UI labels and the orchestrator/report prompts.
export type PanelPersona = {
  id: string
  archetypeId: string
  name: string
  role: string
  tone: string
}

export const PANEL_PERSONAS: PanelPersona[] = [
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

export const panelPersonaById = (id: string): PanelPersona | null =>
  PANEL_PERSONAS.find((persona) => persona.id === id) ?? null
