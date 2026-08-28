import type { Scope, ScopeValue } from "../domains/types.ts"
import { mergeInferredScope } from "./autofill.ts"

// The typed intake's state, one record per lane, owned by the page so it
// outlives lane switches and mode toggles: what you filled on Interview is
// waiting when you come back, and no other lane ever sees it. A deck
// extraction lands from an async callback while the user may be
// mid-keystroke in any lane — the reducer makes every transition atomic.

export type IntakeFormState = {
  scope: Scope
  // Keys the user has edited — autofill never writes these, even empty.
  touched: ReadonlySet<string>
  // Text fields reach the preview rail only once blurred — watching your
  // own keystrokes echo in two places reads uncanny. Chips are always
  // shown; inferred and seeded values commit on arrival.
  committed: ReadonlySet<string>
  // Model-written keys, marked "check this" until the user edits them.
  inferred: ReadonlySet<string>
  // Required fields flagged by a failed submit, cleared as they're filled.
  missingKeys: string[]
  // Extractions in flight, shown under the upload list.
  reading: { storageId: string; fileName: string }[]
  // Every upload ever sent for extraction — one read per upload, however
  // often the effect that triggers reads re-mounts.
  extracted: string[]
  // The latest autofill outcome. filled renders as the accent callout; a
  // miss or failure stays quiet gray.
  notice: { text: string; filled: boolean } | null
}

export type IntakeFormAction =
  | { type: "change"; key: string; value: ScopeValue }
  | { type: "blur"; key: string }
  | { type: "setMissing"; keys: string[] }
  | { type: "seed"; scope: Scope }
  | { type: "readStart"; storageId: string; fileName: string }
  | { type: "autofill"; storageId: string; fileName: string; extracted: Scope }
  | { type: "readFailed"; storageId: string; fileName: string }

export type LaneForms = Record<string, IntakeFormState>

export const initialFormState = (scope?: Scope): IntakeFormState => ({
  scope: scope ?? {},
  touched: new Set(),
  committed: new Set(Object.keys(scope ?? {})),
  inferred: new Set(),
  missingKeys: [],
  reading: [],
  extracted: [],
  notice: null,
})

const withKey = (set: ReadonlySet<string>, key: string): ReadonlySet<string> =>
  set.has(key) ? set : new Set(set).add(key)

const withoutKey = (set: ReadonlySet<string>, key: string): ReadonlySet<string> => {
  if (!set.has(key)) return set
  const next = new Set(set)
  next.delete(key)
  return next
}

const settleReading = (
  state: IntakeFormState,
  storageId: string
): IntakeFormState["reading"] => state.reading.filter((entry) => entry.storageId !== storageId)

// "seed" never reaches here — laneFormsReducer resolves it against the
// whole record (create-if-absent), so this reducer's type excludes it.
const formReducer = (
  state: IntakeFormState,
  action: Exclude<IntakeFormAction, { type: "seed" }>
): IntakeFormState => {
  switch (action.type) {
    case "change":
      return {
        ...state,
        scope: { ...state.scope, [action.key]: action.value },
        touched: withKey(state.touched, action.key),
        inferred: withoutKey(state.inferred, action.key),
        missingKeys: state.missingKeys.filter((key) => key !== action.key),
      }
    case "blur":
      return state.committed.has(action.key)
        ? state
        : { ...state, committed: withKey(state.committed, action.key) }
    case "setMissing":
      return { ...state, missingKeys: action.keys }
    case "readStart":
      return state.extracted.includes(action.storageId)
        ? state
        : {
            ...state,
            extracted: [...state.extracted, action.storageId],
            reading: [
              ...state.reading,
              { storageId: action.storageId, fileName: action.fileName },
            ],
          }
    case "autofill": {
      const merged = mergeInferredScope(state.scope, state.touched, state.inferred, action.extracted)
      const filled = [...merged.inferredKeys].filter((key) => !state.inferred.has(key))
      const reading = settleReading(state, action.storageId)
      if (filled.length === 0) {
        return {
          ...state,
          reading,
          notice: {
            text: `Nothing in ${action.fileName} answered these fields directly.`,
            filled: false,
          },
        }
      }
      const committed = new Set(state.committed)
      for (const key of filled) committed.add(key)
      return {
        ...state,
        scope: merged.scope,
        committed,
        inferred: merged.inferredKeys,
        reading,
        notice: {
          text: `Filled ${filled.length} ${filled.length === 1 ? "field" : "fields"} from ${action.fileName}. They're marked below. Check them before you continue.`,
          filled: true,
        },
      }
    }
    case "readFailed":
      return {
        ...state,
        reading: settleReading(state, action.storageId),
        notice: {
          text: `Couldn't read ${action.fileName} to fill fields. It's still attached for the session.`,
          filled: false,
        },
      }
  }
}

export const laneFormsReducer = (
  forms: LaneForms,
  event: { lane: string; action: IntakeFormAction }
): LaneForms => {
  const existing = forms[event.lane]
  if (event.action.type === "seed") {
    return existing ? forms : { ...forms, [event.lane]: initialFormState(event.action.scope) }
  }
  return {
    ...forms,
    [event.lane]: formReducer(existing ?? initialFormState(), event.action),
  }
}
