import { bySpokenTime } from "../../lib/transcript.ts"
import {
  composeWithinBudget,
  deliveredItems,
  openItems,
  scopeList,
  scopeText,
  spokenCommitment,
  type BriefingInput,
  type RoomBriefing,
} from "../types.ts"

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

// Per-session avatar briefing, assembled from what the app already knows.
export const buildRoomBriefing = ({
  scope,
  audit,
  continuity,
  transcript,
}: BriefingInput): RoomBriefing => {
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
  // the avatar must not open by claiming familiarity with documents that
  // don't exist.
  const readMaterial = (audit?.claims.length ?? 0) > 0

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have spoken with this seller about ${offering} in an earlier session; do not introduce yourself as if meeting for the first time.`,
        open.length > 0
          ? ` They committed to: ${open.map((item) => item.text).join("; ")}. Follow up on these before anything new.`
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
      ? `Good to see you again. Last time you said you'd ${spokenCommitment(open[0])} — walk me through where that landed.`
      : readMaterial
        ? `Thanks for making the time. I read through the ${offering} material before this, and I have questions. Tell me what you're bringing me.`
        : `Alright, you've got my attention. Tell me what you're bringing me, and why it matters for someone in my seat.`

  return {
    personalityPreamble: composeWithinBudget([
      `Session context: the seller is pitching "${offering}" — ${description.slice(0, 300)}.${roleContext}${askContext}`,
      ...continuityContext,
      objectionContext,
      auditContext,
    ]) + "\n\n",
    startScript,
  }
}
