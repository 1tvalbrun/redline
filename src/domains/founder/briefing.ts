import { deriveAuditRiskScores } from "../../lib/preRunScores.ts"
import { deriveReadiness } from "../../lib/readiness.ts"
import { bySpokenTime } from "../../lib/transcript.ts"
import { scopeText, type BriefingInput, type RoomBriefing } from "../types.ts"
import { FOUNDER_AXES, FOUNDER_AXIS_KEYS } from "./axes.ts"

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

// How a person names each weak spot out loud. The axis labels are UI
// labels; spoken, "talk about customer" reads like a form field.
const SPOKEN_AXIS: Record<string, string> = {
  market: "the market story",
  customer: "who this is actually for",
  technical: "the technical side",
  gtm: "how you're going to sell this",
}

const axisLabel = (key: string): string =>
  FOUNDER_AXES.find((axis) => axis.key === key)?.label ?? key

// Per-session avatar briefing, assembled from what the app already knows.
export const buildRoomBriefing = ({ scope, audit, transcript }: BriefingInput): RoomBriefing => {
  const ideaName = scopeText(scope, "ideaName")
  const description = scopeText(scope, "description")
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
    ? deriveReadiness(FOUNDER_AXIS_KEYS, deriveAuditRiskScores(audit, FOUNDER_AXIS_KEYS)).underFire
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
          weakest ? ` Press hardest on ${axisLabel(weakest).toLowerCase()}.` : ""
        }`
      : ""

  // Only claim to have read materials when the audit actually cited some —
  // an audit over nothing citable still finds a weakest axis, and the
  // avatar must not open by claiming familiarity with documents that
  // don't exist.
  const readMaterials = (audit?.claims.length ?? 0) > 0

  return {
    personalityPreamble: `Session context: the founder is pitching "${ideaName}" — ${description.slice(0, 300)}.${auditContext}\n\n`,
    startScript: weakest
      ? readMaterials
        ? `Thanks for making the time. I went through the ${ideaName} materials, and before anything else I want to get into ${SPOKEN_AXIS[weakest] ?? axisLabel(weakest).toLowerCase()} — that's where your case is thinnest.`
        : `Thanks for making the time. Before anything else I want to get into ${SPOKEN_AXIS[weakest] ?? axisLabel(weakest).toLowerCase()} — that's where your case is thinnest.`
      : `Alright, let's get into it. Give me the one-minute version of ${ideaName}.`,
  }
}
