import type { Scope, ScopeValue } from "../domains/types"

export type AutofillResult = {
  scope: Scope
  inferredKeys: ReadonlySet<string>
}

const isEmpty = (value: ScopeValue | undefined): boolean =>
  value === undefined || (typeof value === "string" ? value.trim() === "" : value.length === 0)

// Merges a deck extraction into the form's scope. A field fills only when
// it is empty AND the user never touched it — a touched-but-empty field is
// a choice, and an earlier fill (inferred or typed) is never overwritten.
// inferredKeys accumulates across extractions so every model-written field
// stays marked for review until the user edits it.
export const mergeInferredScope = (
  current: Scope,
  touchedKeys: ReadonlySet<string>,
  inferredKeys: ReadonlySet<string>,
  extracted: Scope
): AutofillResult => {
  const scope = { ...current }
  const inferred = new Set(inferredKeys)
  for (const [key, value] of Object.entries(extracted)) {
    if (isEmpty(value) || touchedKeys.has(key) || !isEmpty(current[key])) continue
    scope[key] = value
    inferred.add(key)
  }
  return { scope, inferredKeys: inferred }
}
