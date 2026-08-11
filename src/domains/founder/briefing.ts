import { bySpokenTime } from "../../lib/transcript.ts"
import {
  composeWithinBudget,
  deliveredItems,
  openItems,
  scopeText,
  spokenCommitment,
  type BriefingInput,
  type RoomBriefing,
} from "../types.ts"

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

// Per-session avatar briefing, assembled from what the app already knows.
export const buildRoomBriefing = ({
  scope,
  audit,
  continuity,
  transcript,
}: BriefingInput): RoomBriefing => {
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

  // Blockers first, same priority the audit UI gives them.
  const gapTitles = audit
    ? [...audit.gaps]
        .sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"))
        .slice(0, 3)
        .map((gap) => gap.title)
    : []
  const auditContext =
    gapTitles.length > 0
      ? ` The pre-session audit flagged: ${gapTitles.join("; ")}. Press hardest there.`
      : ""

  // Only claim to have read materials when the audit actually cited some —
  // the avatar must not open by claiming familiarity with documents that
  // don't exist.
  const readMaterials = (audit?.claims.length ?? 0) > 0

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have spoken with this founder about ${ideaName} in an earlier session; do not introduce yourself as if meeting for the first time.`,
        open.length > 0
          ? ` They committed to: ${open.map((item) => item.text).join("; ")}. Follow up on these.`
          : "",
        delivered.length > 0
          ? ` They have already delivered: ${delivered.map((item) => item.text).join("; ")} — you received these; thank them briefly if relevant and do not ask for them again.`
          : "",
        continuity.lastSessionSummary
          ? ` Where the last session left off: ${continuity.lastSessionSummary}`
          : "",
      ]
    : []

  const startScript =
    open.length > 0
      ? `Good to see you back. Last time you said you'd ${spokenCommitment(open[0])} — tell me how that went.`
      : readMaterials
        ? `Thanks for making the time. I went through the ${ideaName} materials before this, so let's get straight into it. Give me the one-minute version.`
        : `Alright, let's get into it. Give me the one-minute version of ${ideaName}.`

  return {
    personalityPreamble: composeWithinBudget([
      `Session context: the founder is pitching "${ideaName}" — ${description.slice(0, 300)}.`,
      ...continuityContext,
      auditContext,
    ]) + "\n\n",
    startScript,
  }
}
