export type BriefOption = { value: string; label: string }

export const STAGE_OPTIONS: BriefOption[] = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "beta", label: "Beta" },
  { value: "early-revenue", label: "Early revenue" },
  { value: "growth", label: "Growth / Series A+" },
]

export const FOCUS_OPTIONS = [
  "Market need",
  "Willingness to pay",
  "Technical feasibility",
  "Competition",
  "Go-to-market",
  "Pricing",
  "User experience",
  "Fundraising story",
]
