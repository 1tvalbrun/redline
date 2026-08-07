import type { ScoreAxis } from "../types.ts"

// The founder lane's four diligence axes. The orchestrate prompt owns their
// scoring meaning; these entries feed UI labels and axis-key validation.
export const FOUNDER_AXES: ScoreAxis[] = [
  { key: "market", label: "Market" },
  { key: "customer", label: "Customer" },
  { key: "technical", label: "Technical" },
  { key: "gtm", label: "Go-to-market" },
]

export const FOUNDER_AXIS_KEYS = FOUNDER_AXES.map((axis) => axis.key)
