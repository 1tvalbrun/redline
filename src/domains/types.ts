import type { Claim, Gap } from "../lib/audit.ts"
import type { Blueprint } from "../lib/blueprint.ts"

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

// One field of the shaping extraction (practices.context).
export type ContextField = { key: string; label: string }

// Verdict tones double as the direction scale ("up from last time"):
// bad < mid < good. See verdictDirection in registry.
export type VerdictTone = "good" | "mid" | "bad"
export type VerdictOption = { value: string; label: string; tone: VerdictTone }

// An interviewer identity. The spoken personality lives on the Runway
// Character; these fields feed UI labels and the debrief prompts. attack is
// the meet card's "what they come for" line; bio and tags feed persona
// cards.
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
  // Their signature opening question, rendered as the card's serif quote.
  signature: string
}

// "Dr. Sarah Okafor" → "Sarah", never "Dr." — honorifics end in a period.
export const firstNameOf = (name: string): string =>
  name.split(" ").find((word) => !word.endsWith(".")) ?? name

// "Dr. Sarah Okafor" → "SO": monogram from the first two non-honorific words.
export const initialsOf = (name: string): string =>
  name
    .split(" ")
    .filter((word) => word.length > 0 && !word.endsWith("."))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("")

// Per-session avatar briefing. personalityPreamble is prepended to the
// persona stored on the Runway Character; startScript replaces its canned
// opener, which otherwise repeats verbatim every session, including resumes
// (each connect is a fresh Runway session; only our transcript survives).
export type RoomBriefing = {
  personalityPreamble: string
  startScript: string
}

// Cross-session memory (practices.continuity): what the last session
// concluded and what the user committed to. Written at debrief time,
// surfaced in the next session's briefing and opener.
export type ActionItemStatus = "open" | "done" | "dropped"
export type ActionItemPriority = "high" | "medium" | "low"
export type ActionItem = {
  id: string
  text: string
  priority: ActionItemPriority
  status: ActionItemStatus
  createdAt: number
  settledAt?: number
}
export type Continuity = {
  lastSessionSummary: string
  actionItems: ActionItem[]
  updatedAt: number
}

export type BriefingInput = {
  scope: Scope
  audit: { claims: Claim[]; gaps: Gap[] } | null
  // The interview lane's prep artifact; other lanes never receive one.
  blueprint?: Blueprint | null
  continuity: Continuity | null
  transcript: { text: string; type: "user" | "panelist"; timestamp: number; spokenAt?: number }[]
}

// The session personality override is capped by Runway (10k chars) and has
// to leave room for the turn-taking rules and the Character's stored
// personality, so the preamble gets a fixed budget. Sections arrive in
// priority order; once one doesn't fit, it and everything after it are
// dropped whole — a truncated sentence in a persona reads as a glitch.
export const PREAMBLE_BUDGET = 4000

export const composeWithinBudget = (sections: string[], budget = PREAMBLE_BUDGET): string => {
  let remaining = budget
  const kept: string[] = []
  for (const section of sections) {
    if (section.length === 0) continue
    if (section.length > remaining) break
    kept.push(section)
    remaining -= section.length
  }
  return kept.join("")
}

// Open commitments, oldest first (the longest-standing promise is the one
// to follow up on), and delivered items newest first (fresh wins matter).
export const openItems = (continuity: Continuity | null): ActionItem[] =>
  (continuity?.actionItems ?? [])
    .filter((item) => item.status === "open")
    .sort((a, b) => a.createdAt - b.createdAt)

export const deliveredItems = (continuity: Continuity | null): ActionItem[] =>
  (continuity?.actionItems ?? [])
    .filter((item) => item.status === "done")
    .sort((a, b) => b.createdAt - a.createdAt)

// Action items are authored verb-first ("Send two references"), so they
// slot into spoken lines as "you said you'd send two references".
export const spokenCommitment = (item: ActionItem): string => {
  const text = item.text.trim().replace(/\.$/, "")
  return text.charAt(0).toLowerCase() + text.slice(1)
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
  // Blueprint theme titles, for lanes that track prepared-theme coverage.
  themes?: string[] | null
}

export type DebriefPromptInput = {
  scope: Scope
  characterName: string
  characterRole: string
  characterTone: string
  notes: string
  transcript: string
  // The engagement's memory going into this session, so the debrief can
  // compound the summary instead of replacing it and never re-emit a
  // commitment that's already tracked. Null on a first session.
  continuity: {
    summary: string
    open: string[]
    delivered: string[]
  } | null
  // The prep blueprint's sealed rubric and verify topics, so feedback traces
  // to pre-declared criteria. Null for lanes without a blueprint.
  blueprint?: {
    rubric: { theme: string; strong: string; weak: string }[]
    verifyTopics: string[]
  } | null
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

export type BlueprintPromptInput = {
  scope: Scope
  unreadableCount: number
  materialSections: string
}

export type BlueprintRefineInput = {
  scope: Scope
  blueprint: Blueprint
  removedThemes: string[]
  redirectNote: string
}

export type PrepStageCopy = {
  kicker: string
  readyHeading: string
  readyLead: string
  cta: string
}

export type AuditPrep = {
  kind: "audit"
  stepLabel: string
  prompt: (input: AuditPromptInput) => string
  wait: StageWaitCopy
  copy: PrepStageCopy & { zeroClaims: string }
}

export type BlueprintPrep = {
  kind: "blueprint"
  stepLabel: string
  prompt: (input: BlueprintPromptInput) => string
  refine: (input: BlueprintRefineInput) => string
  wait: StageWaitCopy
  copy: PrepStageCopy
}

// One row of the typed form's live-preview rail: which scope field it
// mirrors, how the reader labels it, and the coaching hint shown while
// it's empty.
export type PreviewRow = { key: string; label: string; hint: string }

export type PackCopy = {
  // The wizard's voice-first opening beat.
  tellIt: { heading: string; sub: string }
  // Typed-form structure: fields grouped into titled sections, in order.
  form: {
    sections: { title: string; meta?: string; keys: string[] }[]
    materialsTitle: string
    materialsMeta: string
  }
  // The "what {persona} will read" rail beside the typed form.
  preview: {
    title: string
    rows: PreviewRow[]
    chips: { label: string; keys: string[] }
    footer: string
  }
  readWait: StageWaitCopy
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
  // Compact lane name for chips and rail headers ("Founder", "Sales", …).
  shortLabel: string
  description: string
  // The lane chooser's start button. Authored per lane — composing it from
  // the label produces grammar like "Start a face an audit practice".
  startCta: string
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
  // Closed verdict vocabulary. fallback is stored when model output is
  // outside it.
  verdicts: { options: VerdictOption[]; fallback: string }
  // The assessor's evidence request list for the current scope, shown at
  // intake before upload — the real-audit order is "here's what to
  // produce", then evidence, then the interview. Only packs with a
  // pre-declared evidence model define it.
  evidenceRequests?: (scope: Scope) => { title: string; items: string[] }[]
  // The middle stage between the read and the panel, discriminated so an
  // interview pack cannot carry a dangling audit prompt and an audit pack
  // cannot omit one. stepLabel names the beat in the flow rail.
  prep: AuditPrep | BlueprintPrep
  // Scope key whose value labels the session in the room header and panel
  // card ("Session 4 · CourtTime · Data recovery"). Absent means the lane
  // has no per-session focus; the shortLabel shows instead.
  sessionMetaField?: string
  // Pack-supplied persona recommendation, consulted after "you faced them
  // last time" and before the generic focusAreas heuristic. Null means no
  // opinion.
  recommendPersona?: (scope: Scope) => { personaId: string; reason: string } | null
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
    orchestrate: (input: OrchestratePromptInput) => string
    debrief: (input: DebriefPromptInput) => string
    // Spoken pitch → this pack's scope fields, extraction-only (never
    // invent; absent means unsaid). Every lane has voice intake.
    extractScope: (input: { source: "voice" | "deck"; pitch: string }) => string
  }
}
