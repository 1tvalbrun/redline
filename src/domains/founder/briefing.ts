import { deriveAuditRiskScores } from "../../lib/preRunScores.ts"
import { AXIS_LABELS, deriveReadiness, type Axis } from "../../lib/readiness.ts"
import { bySpokenTime } from "../../lib/transcript.ts"
import type { BriefingInput, RoomBriefing } from "../types.ts"

// The GWM engine fills founder pauses with presence check-ins ("Still with
// me?"), which reads as the avatar not listening. The session-level
// personality override is the only turn-taking lever the API exposes, so the
// stored persona is extended with explicit pause rules for each session.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the founder's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
founder pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: press, question, and challenge exactly as your character \
demands.

`

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160

// How a person names each weak spot out loud. AXIS_LABELS are UI labels;
// spoken, "talk about customer" reads like a form field.
const SPOKEN_AXIS: Record<Axis, string> = {
  market: "the market story",
  customer: "who this is actually for",
  technical: "the technical side",
  gtm: "how you're going to sell this",
}

// Per-session avatar briefing, assembled from what the app already knows.
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
        "Good to see you back. Let's pick up right where we left off. Go ahead.",
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
      ? `Thanks for making the time. I went through the ${ideaName} materials, and before anything else I want to get into ${SPOKEN_AXIS[weakest]} — that's where your case is thinnest.`
      : `Alright, let's get into it. Give me the one-minute version of ${ideaName}.`,
  }
}
