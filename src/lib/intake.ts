import { field } from "./audit.ts"
import type { Scope, ScopeField } from "../domains/types.ts"

const MULTI_MAX_ITEMS = 8
const TEXT_FALLBACK_CHARS = 60

const clampText = (value: unknown, limit: number): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, limit)
}

// Model output → honest extraction, keyed by the pack's scope fields.
// Anything missing, junk, or outside a field's option vocabulary is simply
// absent from the result — an absent key renders as "Not heard", never a
// guess. Same clamping rules practices.create enforces on write.
export const parseExtractedScope = (raw: unknown, fields: ScopeField[]): Scope => {
  const scope: Scope = {}
  for (const scopeField of fields) {
    const value = field(raw, scopeField.key)
    const labels = scopeField.options?.map((option) => option.label)
    if (scopeField.kind === "multi") {
      if (!Array.isArray(value)) continue
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => (labels ? labels.includes(item) : item.length > 0))
        .slice(0, MULTI_MAX_ITEMS)
      if (items.length > 0) scope[scopeField.key] = items
    } else {
      const text = clampText(value, scopeField.maxLength ?? TEXT_FALLBACK_CHARS)
      if (text === null) continue
      if (scopeField.kind === "chips" && labels && !labels.includes(text)) continue
      scope[scopeField.key] = text
    }
  }
  return scope
}
