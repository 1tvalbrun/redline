import { PANEL_PERSONAS } from "./personas.ts"
import type { DomainPack } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, extractBrief, orchestrate, report } from "./prompts.ts"

export const founderPack: DomainPack = {
  id: "founder",
  label: "Pitch a startup",
  description:
    "Face an investor panel before the real one. Your idea gets read, audited, and interrogated live, then scored.",
  personas: PANEL_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, extractBrief, audit, orchestrate, report },
}
