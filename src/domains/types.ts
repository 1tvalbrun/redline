import type { Claim, Gap } from "../lib/audit.ts"

// The engine/pack contract. The engine (Convex actions, the connect route,
// the flow UI) is domain-blind and pulls everything domain-flavored from a
// DomainPack; a new lane is a new pack module, not new engine code. Fields
// exist only once a real consumer does; the contract grows with each lane.

// What the user brings into an engagement, keyed by the pack's scopeFields.
// Multi-select fields hold arrays; everything else is a string.
export type ScopeValue = string | string[]
export type Scope = Record<string, ScopeValue>

export const scopeText = (scope: Scope, key: string): string => {
  const value = scope[key]
  return typeof value === "string" ? value : ""
}

export const scopeList = (scope: Scope, key: string): string[] => {
  const value = scope[key]
  return Array.isArray(value) ? value : []
}

export type ScopeFieldOption = { value: string; label: string }

// One intake field. Drives the generic scope form and the server-side
// validation in simulations.create (unknown keys dropped, sizes clamped).
export type ScopeField = {
  key: string
  label: string
  kind: "text" | "textarea" | "chips" | "multi"
  required?: boolean
  maxLength?: number
  placeholder?: string
  // The chip vocabulary for chips/multi fields. The stored value is the
  // label (what the user saw), matching how the founder intake always
  // stored its options.
  options?: ScopeFieldOption[]
}

// One field of the Read stage's extraction (simulations.context).
export type ContextField = { key: string; label: string }

// One live scoring dimension. The orchestrate prompt owns the axis's
// meaning; the label is what the UI prints.
export type ScoreAxis = { key: string; label: string }

export type VerdictTone = "good" | "mid" | "bad"
export type VerdictOption = { value: string; label: string; tone: VerdictTone }

// An interviewer identity. The spoken personality lives on the Runway
// Character; these fields feed UI labels and the scoring/report prompts.
// attack is the panel card's "what they come for" line; bio and tags feed
// the workspace Panel page; axes are the dimensions this persona presses
// hardest (recommendation + verdict speaker).
export type AttackSegment = { text: string; strong?: boolean }
export type Persona = {
  id: string
  archetypeId: string
  name: string
  role: string
  shortRole: string
  tone: string
  image: string
  attack: AttackSegment[]
  bio: string
  tags: string[]
  axes: string[]
}

// Legacy founder-shaped scope (simulations.brief on pre-M3 rows). New rows
// store scope; scopeOf (registry) folds this shape into a Scope.
export type Brief = {
  ideaName: string
  stage: string
  description: string
  targetUser: string
  businessModel: string
  whyNow?: string
  focusAreas: string[]
}

// Per-session avatar briefing. personalityPreamble is prepended to the
// persona stored on the Runway Character; startScript replaces its canned
// opener, which otherwise repeats verbatim every session, including resumes
// (each connect is a fresh Runway session; only our transcript survives).
export type RoomBriefing = {
  personalityPreamble: string
  startScript: string
}

export type BriefingInput = {
  scope: Scope
  audit: { claims: Claim[]; gaps: Gap[] } | null
  transcript: { text: string; type: "user" | "panelist"; timestamp: number; spokenAt?: number }[]
}

export type AuditPromptInput = {
  scope: Scope
  unreadableCount: number
  materialSections: string
}

export type OrchestratePromptInput = {
  characterName: string
  characterRole: string
  characterTone: string
  scope: Scope
  current: Record<string, number>
}

export type ReportPromptInput = {
  scope: Scope
  characterName: string
  characterRole: string
  characterTone: string
  notes: string
  transcript: string
}

// Stage copy the flow UI renders. Waiting rows carry anticipatory copy
// about what's being examined, never extracted values; heading takes the
// engagement subject (packs that don't interpolate it ignore it).
export type WaitingRow = { label: string; text: string }
export type StageWaitCopy = {
  kicker: string
  heading: (subject: string) => string
  lead: string
  rows: WaitingRow[]
  work: string[]
  ticker: string[]
  stepMs: number
}

// Copy for the generic scope-form intake. Only packs without a bespoke
// intake component define it; the founder lane's BriefForm carries its own.
export type IntakeCopy = {
  kicker: string
  heading: string
  lead: string
  materialsLabel: string
  materialsButton: string
  cta: string
}

export type PackCopy = {
  intake?: IntakeCopy
  readWait: StageWaitCopy
  auditWait: StageWaitCopy
  audit: {
    kicker: string
    readyHeading: string
    readyLead: string
    zeroClaims: string
    cta: string
  }
  panel: {
    kicker: string
    heading: string
    lead: string
  }
  // The in-room nudge lines under the transcript.
  promptHelpers: string[]
}

export type DomainPack = {
  id: string
  // Onboarding card copy (the lane chooser).
  label: string
  description: string
  // The scope key that names the engagement: feeds the ideas row, list
  // display, and the briefing subject.
  subjectField: string
  // Scope keys shown as list/detail metadata under the subject (e.g. the
  // founder lane's stage and business model).
  subtitleFields: string[]
  // How prompts label the human's transcript turns (e.g. "FOUNDER"), and
  // how the room UI titles them (e.g. "Founder").
  userLabel: string
  userTitle: string
  scopeFields: ScopeField[]
  contextFields: ContextField[]
  axes: ScoreAxis[]
  // Closed verdict vocabulary. fallback is stored when model output is
  // outside it.
  verdicts: { options: VerdictOption[]; fallback: string }
  // The readiness bar the gauge draws (e.g. 90 "Investor-ready").
  targetLine: { value: number; label: string }
  copy: PackCopy
  personas: Persona[]
  // Session-personality preamble rules and the per-session briefing builder,
  // composed by /api/avatar/connect.
  turnTaking: string
  briefing: (input: BriefingInput) => RoomBriefing
  prompts: {
    analyzeSystem: string
    analyzeUser: (scope: Scope) => string
    // Voice/deck pitch extraction; only packs with a spoken intake have one.
    extractBrief?: (input: { source: "voice" | "deck"; pitch: string }) => string
    audit: (input: AuditPromptInput) => string
    orchestrate: (input: OrchestratePromptInput) => string
    report: (input: ReportPromptInput) => string
  }
}
