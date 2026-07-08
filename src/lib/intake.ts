import {
  BUSINESS_MODEL_OPTIONS,
  STAGE_OPTIONS,
  TARGET_OPTIONS,
  type BriefOption,
} from "./briefOptions.ts"

// Every field is what-was-actually-said or null. Null renders as a flagged
// gap for the founder to fill — extraction can never invent content.
export type ExtractedBrief = {
  ideaName: string | null
  description: string | null
  whyNow: string | null
  stage: string | null
  businessModel: string | null
  targetUser: string | null
}

const FREE_TEXT_LIMITS = { ideaName: 60, description: 600, whyNow: 400 } as const

const field = (raw: unknown, key: string): unknown =>
  typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>)[key] : undefined

const freeText = (value: unknown, limit: number): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed
}

const optionValue = (value: unknown, options: BriefOption[]): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return options.find((option) => option.value === normalized)?.value ?? null
}

// Model output → honest extraction. Anything missing, junk, or outside the
// allowed option vocabulary becomes null (a flagged gap), never a guess.
export const parseExtractedBrief = (raw: unknown): ExtractedBrief => ({
  ideaName: freeText(field(raw, "ideaName"), FREE_TEXT_LIMITS.ideaName),
  description: freeText(field(raw, "description"), FREE_TEXT_LIMITS.description),
  whyNow: freeText(field(raw, "whyNow"), FREE_TEXT_LIMITS.whyNow),
  stage: optionValue(field(raw, "stage"), STAGE_OPTIONS),
  businessModel: optionValue(field(raw, "businessModel"), BUSINESS_MODEL_OPTIONS),
  targetUser: optionValue(field(raw, "targetUser"), TARGET_OPTIONS),
})
