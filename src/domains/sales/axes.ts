import type { ScoreAxis } from "../types.ts"

// The sales lane's four deal axes. The orchestrate prompt owns their
// scoring meaning; these entries feed UI labels and axis-key validation.
// "close" exists because the most common seller failure is leaving without
// a concrete next step — it is scored, not just advised on.
export const SALES_AXES: ScoreAxis[] = [
  { key: "value", label: "Value" },
  { key: "fit", label: "Fit" },
  { key: "objections", label: "Objections" },
  { key: "close", label: "The close" },
]

export const SALES_AXIS_KEYS = SALES_AXES.map((axis) => axis.key)
