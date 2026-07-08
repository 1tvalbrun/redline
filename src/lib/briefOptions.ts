export type BriefOption = { value: string; label: string }

export const STAGE_OPTIONS: BriefOption[] = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "beta", label: "Beta" },
  { value: "early-revenue", label: "Early revenue" },
  { value: "growth", label: "Growth / Series A+" },
]

export const TARGET_OPTIONS: BriefOption[] = [
  { value: "smb-founders", label: "SMB founders and operators" },
  { value: "midmarket-leaders", label: "Mid-market product & strategy leaders" },
  { value: "enterprise-buyers", label: "Enterprise buyers ($500M+ ARR)" },
  { value: "vc-backed-saas", label: "VC-backed B2B SaaS, Series B–D, $20–500M ARR" },
  { value: "developers", label: "Developers and engineering teams" },
  { value: "designers-creators", label: "Designers and creators" },
  { value: "consumers", label: "Direct-to-consumer audiences" },
]

export const BUSINESS_MODEL_OPTIONS: BriefOption[] = [
  { value: "saas-seat", label: "SaaS: per-seat pricing" },
  { value: "saas-usage", label: "SaaS: usage-based pricing" },
  { value: "saas-tiered", label: "SaaS: tiered subscription" },
  { value: "marketplace", label: "Marketplace / take-rate" },
  { value: "ads", label: "Ad-supported / free with ads" },
  { value: "transactional", label: "Transactional / one-time" },
  { value: "freemium", label: "Freemium with paid upgrade" },
  { value: "enterprise-license", label: "Enterprise license" },
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

export const optionLabel = (options: BriefOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value
