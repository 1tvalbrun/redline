import type { Claim, Gap } from "./audit.ts"
import { deriveAuditRiskScores } from "./preRunScores.ts"
import { AXIS_LABELS, deriveReadiness } from "./readiness.ts"
import { bySpokenTime } from "./transcript.ts"

// Per-session avatar briefing, assembled from what the app already knows.
// personalityPreamble is prepended to the stored persona (same lever as the
// turn-taking rules); startScript replaces the Character's canned opener,
// which otherwise repeats verbatim every session — including resumes, where
// the avatar has no memory of the prior conversation (each connect is a
// fresh Runway session; only our transcript survives).
export type RoomBriefing = {
  personalityPreamble: string
  startScript: string
}

type BriefingInput = {
  ideaName: string
  description: string
  audit: { claims: Claim[]; gaps: Gap[] } | null
  transcript: { text: string; type: "user" | "panelist"; timestamp: number; spokenAt?: number }[]
}

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160

export const buildRoomBriefing = ({
  ideaName,
  description,
  audit,
  transcript,
}: BriefingInput): RoomBriefing => {
  if (transcript.length > 0) {
    const digest = bySpokenTime(transcript)
      .slice(-DIGEST_TURNS)
      .map((e) => `${e.type === "user" ? "FOUNDER" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
      .join("\n")
    return {
      personalityPreamble: `Session context: this resumes an earlier conversation with the same founder about "${ideaName}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the interrogation from there.\n\n`,
      startScript:
        "Good — you're back. We're picking up where we left off, not starting over. Go on.",
    }
  }

  const weakest = audit
    ? deriveReadiness(deriveAuditRiskScores(audit)).underFire
    : null
  // Blockers first, same priority the audit UI gives them.
  const gapTitles = audit
    ? [...audit.gaps]
        .sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"))
        .slice(0, 3)
        .map((gap) => gap.title)
    : []
  const auditContext =
    gapTitles.length > 0
      ? ` The pre-session audit flagged: ${gapTitles.join("; ")}.${
          weakest ? ` Press hardest on ${AXIS_LABELS[weakest].toLowerCase()}.` : ""
        }`
      : ""

  return {
    personalityPreamble: `Session context: the founder is pitching "${ideaName}" — ${description.slice(0, 300)}.${auditContext}\n\n`,
    startScript: weakest
      ? `Thanks for sitting down with me. I've been through the ${ideaName} materials, and before we go anywhere else I want to talk about ${AXIS_LABELS[weakest].toLowerCase()} — that's where your case is thinnest.`
      : `Let's get started. Give me the one-minute version of ${ideaName}, and don't polish it.`,
  }
}
