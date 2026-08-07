import { deriveAuditRiskScores } from "../../lib/preRunScores.ts"
import { deriveReadiness } from "../../lib/readiness.ts"
import { bySpokenTime } from "../../lib/transcript.ts"
import { scopeList, scopeText, type BriefingInput, type RoomBriefing } from "../types.ts"
import { SALES_AXIS_KEYS } from "./axes.ts"

// Same pause discipline as the founder lane, in the buyer's frame: the GWM
// engine fills silence with presence check-ins, and a buyer who narrates
// the seller's pauses reads as not listening.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the seller's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
seller pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: question, push back, and weigh the pitch exactly as your \
character demands.

`

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160

// How a buyer names each weak spot out loud.
const SPOKEN_AXIS: Record<string, string> = {
  value: "what this is actually worth to me",
  fit: "whether this fits how we operate",
  objections: "the concerns you're going to hear from people like me",
  close: "what exactly you're asking me to commit to",
}

// Per-session avatar briefing, assembled from what the app already knows.
export const buildRoomBriefing = ({ scope, audit, transcript }: BriefingInput): RoomBriefing => {
  const offering = scopeText(scope, "offering")
  const description = scopeText(scope, "description")
  const prospect = scopeText(scope, "prospect")
  const ask = scopeText(scope, "ask")
  const expected = scopeList(scope, "objections")

  if (transcript.length > 0) {
    const digest = bySpokenTime(transcript)
      .slice(-DIGEST_TURNS)
      .map((e) => `${e.type === "user" ? "SELLER" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
      .join("\n")
    return {
      personalityPreamble: `Session context: this resumes an earlier conversation with the same seller about "${offering}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the conversation from there.\n\n`,
      startScript:
        "Good to see you again. We were mid-conversation, so go ahead — pick it up wherever you left it.",
    }
  }

  const weakest = audit
    ? deriveReadiness(SALES_AXIS_KEYS, deriveAuditRiskScores(audit, SALES_AXIS_KEYS)).underFire
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
      ? ` The pre-session audit of the seller's materials flagged: ${gapTitles.join("; ")}.`
      : ""
  const roleContext = prospect
    ? ` You are playing the seller's actual prospect: ${prospect}.`
    : ""
  const askContext = ask ? ` The seller wants you to say yes to: ${ask}.` : ""
  const objectionContext =
    expected.length > 0
      ? ` The seller expects these objections, so raise them naturally where they fit: ${expected.join(", ")}.`
      : ""

  // Only claim to have read material when the audit actually cited some —
  // an audit over nothing citable still finds a weakest axis, and the
  // avatar must not open by claiming familiarity with documents that
  // don't exist.
  const readMaterial = (audit?.claims.length ?? 0) > 0

  return {
    personalityPreamble: `Session context: the seller is pitching "${offering}" — ${description.slice(0, 300)}.${roleContext}${askContext}${objectionContext}${auditContext}\n\n`,
    startScript: weakest
      ? readMaterial
        ? `Thanks for making the time. I read through the ${offering} material before this, and I want to start with ${SPOKEN_AXIS[weakest] ?? weakest} — that's where I have the most questions.`
        : `Thanks for making the time. I want to start with ${SPOKEN_AXIS[weakest] ?? weakest} — that's where I have the most questions.`
      : `Alright, you've got my attention. Tell me what you're bringing me, and why it matters for someone in my seat.`,
  }
}
