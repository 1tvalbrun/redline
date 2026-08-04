import type { Claim, Gap } from "../lib/audit.ts"

// The engine/pack contract. The engine (Convex actions, the connect route,
// onboarding) is domain-blind and pulls everything domain-flavored from a
// DomainPack; a new lane is a new pack module, not new engine code. Fields
// exist only once a real consumer does; the contract grows with each lane.
// An interviewer identity. The spoken personality lives on the Runway
// Character; these fields feed UI labels and the scoring/report prompts.
export type Persona = {
  id: string
  archetypeId: string
  name: string
  role: string
  tone: string
}

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
  ideaName: string
  description: string
  audit: { claims: Claim[]; gaps: Gap[] } | null
  transcript: { text: string; type: "user" | "panelist"; timestamp: number; spokenAt?: number }[]
}

export type AuditPromptInput = {
  brief: Brief
  unreadableCount: number
  materialSections: string
}

export type OrchestratePromptInput = {
  characterName: string
  characterRole: string
  characterTone: string
  brief: Brief
  current: { market: number; customer: number; technical: number; gtm: number }
}

export type ReportPromptInput = {
  brief: Brief
  characterName: string
  characterRole: string
  characterTone: string
  notes: string
  transcript: string
}

export type DomainPack = {
  id: string
  // Onboarding card copy (the lane chooser).
  label: string
  description: string
  personas: Persona[]
  // Session-personality preamble rules and the per-session briefing builder,
  // composed by /api/avatar/connect.
  turnTaking: string
  briefing: (input: BriefingInput) => RoomBriefing
  prompts: {
    analyzeSystem: string
    analyzeUser: (brief: Brief) => string
    extractBrief: (input: { source: "voice" | "deck"; pitch: string }) => string
    audit: (input: AuditPromptInput) => string
    orchestrate: (input: OrchestratePromptInput) => string
    report: (input: ReportPromptInput) => string
  }
}
