// The objection catalog: the recurring ways a buyer says no, with the probe
// a skeptical operator actually uses. The intake multi-select, the briefing,
// and the prompts all draw from this one list.
export type Objection = {
  key: string
  label: string
  probe: string
}

export const OBJECTIONS: Objection[] = [
  {
    key: "status-quo",
    label: "We're fine as is",
    probe: "What we do today works. What breaks if I change nothing?",
  },
  {
    key: "switching-cost",
    label: "Switching cost",
    probe: "Ripping out the current process costs me time and goodwill. Who pays for that?",
  },
  {
    key: "price",
    label: "Price",
    probe: "Put the price next to the payoff. Where does the money come back?",
  },
  {
    key: "trust",
    label: "Track record",
    probe: "Who is using this today, and what happened at month three?",
  },
  {
    key: "integration",
    label: "Integration",
    probe: "How does this sit with the systems and habits my team already has?",
  },
  {
    key: "adoption",
    label: "Staff adoption",
    probe: "My people have to use it every day. Why would they?",
  },
  {
    key: "authority",
    label: "Decision authority",
    probe: "Say I like it. Who else has to say yes, and what do they need?",
  },
  {
    key: "timing",
    label: "Timing",
    probe: "Why does this decision need to happen this quarter and not next year?",
  },
]

export const objectionByLabel = (label: string): Objection | undefined =>
  OBJECTIONS.find((objection) => objection.label === label)
