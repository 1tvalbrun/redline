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
import { areaByLabel, DEFAULT_AREA } from "./catalog.ts"

// Same pause discipline as the other lanes, in the assessor's frame: the
// GWM engine fills silence with presence check-ins, and an assessor who
// narrates the auditee's pauses reads as not listening. Auditees pause to
// look things up — that's normal in a real session.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the auditee's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
auditee pauses to think or to look something up, sometimes for ten seconds \
or more, often mid-sentence; if a sentence trails off unfinished, wait \
silently — they will continue. When they finish a complete thought and \
stop, engage normally: ask, verify, and press for specifics exactly as \
your character demands.

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
  const systemName = scopeText(scope, "systemName")
  const description = scopeText(scope, "description")
  const role = scopeText(scope, "role")
  const concerns = scopeList(scope, "concerns")
  const area = areaByLabel(scopeText(scope, "controlArea")) ?? DEFAULT_AREA

  if (transcript.length > 0) {
    const digest = bySpokenTime(transcript)
      .slice(-DIGEST_TURNS)
      .map((e) => `${e.type === "user" ? "AUDITEE" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
      .join("\n")
    return {
      personalityPreamble: `Session context: this resumes an earlier audit interview with the same auditee about "${systemName}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the session from there.\n\n`,
      startScript:
        "Welcome back. We were mid-session, so go ahead — pick up where you left off.",
    }
  }

  // Blockers first, same priority the pre-read UI gives them.
  const gapTitles = audit
    ? [...audit.gaps]
        .sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"))
        .slice(0, 3)
        .map((gap) => gap.title)
    : []
  const auditContext =
    gapTitles.length > 0
      ? ` The document pre-read flagged: ${gapTitles.join("; ")}. Ask to see these.`
      : ""
  const roleContext = role ? ` The auditee's role: ${role}.` : ""
  const concernContext =
    concerns.length > 0
      ? ` They named where they feel least ready: ${concerns.join(", ")}. Probe there without announcing it.`
      : ""
  // The catalog is the assessor's only control content: ids, restatements,
  // and the probe each safeguard opens with.
  const areaContext = ` This session covers ${area.label}. The safeguards in scope, which are the ONLY control content you may reference: ${area.safeguards
    .map((s) => `${s.id} ${s.title} — ${s.restatement} Open with: "${s.probe}"`)
    .join(" | ")}`

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have interviewed this auditee about ${systemName} in an earlier session; do not introduce yourself as if meeting for the first time.`,
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

  const readDocuments = (audit?.claims.length ?? 0) > 0
  const startScript =
    open.length > 0
      ? `Good to see you again. Last time you said you'd ${spokenCommitment(open[0])} — let's start there.`
      : readDocuments
        ? `Thanks for making the time. I went through the ${systemName} documents before this session, and I have questions. Let's get into the session scope.`
        : `Thanks for making the time. Let's begin: tell me about ${systemName} and your role in it, and then we'll get into the session scope.`

  return {
    personalityPreamble: composeWithinBudget([
      `Session context: an audit interview practice session on "${systemName}" — ${description.slice(0, 300)}.${roleContext}`,
      areaContext,
      ...continuityContext,
      concernContext,
      auditContext,
    ]) + "\n\n",
    startScript,
  }
}
