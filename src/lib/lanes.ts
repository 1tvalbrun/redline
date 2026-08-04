// The lane registry: which practice experiences exist. Feeds the onboarding
// chooser and validates users.lanes server-side. M2 grows this into full
// domain packs; until then a lane is just an id with onboarding copy.
export type Lane = {
  id: string
  label: string
  description: string
}

export const LANES: Lane[] = [
  {
    id: "founder",
    label: "Pitch a startup",
    description:
      "Face an investor panel before the real one. Your idea gets read, audited, and interrogated live, then scored.",
  },
]

export const isLaneId = (id: string): boolean => LANES.some((lane) => lane.id === id)
