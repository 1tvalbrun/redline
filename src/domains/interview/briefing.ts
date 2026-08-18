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

// Same pause discipline as the other lanes, in the interviewer's frame: the
// GWM engine fills silence with presence check-ins, and an interviewer who
// narrates the candidate's thinking pauses reads as not listening.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the candidate's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
candidate pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: probe, follow up, and press exactly as your character demands.

`

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160
// The room hears at most this many questions per theme — the full plan
// lives in the debrief's rubric, not the preamble budget.
const PLAN_QUESTIONS_PER_THEME = 2

// Per-session avatar briefing, assembled from what the app already knows.
// Sections are ordered by priority and drop whole under the preamble
// budget; honest scoping deliberately outranks resume hooks so the
// guardrail survives whenever regulated territory was flagged.
export const buildRoomBriefing = ({
  scope,
  blueprint,
  continuity,
  transcript,
}: BriefingInput): RoomBriefing => {
  const role = scopeText(scope, "roleTitle")
  const seniority = scopeText(scope, "seniority")
  const industry = scopeText(scope, "industryContext")
  const interviewType = scopeText(scope, "interviewType") || "Full loop (mixed)"
  // Only a landed blueprint briefs the room; generating or failed means the
  // interviewer runs on role framing alone.
  const plan =
    blueprint && (blueprint.status === "ready" || blueprint.status === "awaiting-input")
      ? blueprint
      : null

  if (transcript.length > 0) {
    const digest = bySpokenTime(transcript)
      .slice(-DIGEST_TURNS)
      .map((e) => `${e.type === "user" ? "CANDIDATE" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
      .join("\n")
    return {
      personalityPreamble: `Session context: this resumes an earlier practice interview with the same candidate for "${role}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the interview from there.\n\n`,
      startScript:
        "Good, you're back. We were mid-interview, so go ahead — pick it up wherever you left it.",
    }
  }

  const framing = `Session context: you are interviewing a candidate for "${role}"${
    seniority ? ` at ${seniority} level` : ""
  }${industry ? `, in this context: ${industry}` : ""}. Format: ${interviewType}. This is a live practice interview; run it exactly like the real thing.`

  const planSection =
    plan && plan.questionPlan.length > 0
      ? ` Your prepared question plan, by theme: ${plan.questionPlan
          .map(
            (entry) =>
              `${entry.theme}: ${entry.questions
                .slice(0, PLAN_QUESTIONS_PER_THEME)
                .map((q) => q.question)
                .join(" / ")}`
          )
          .join(" · ")}. Work from this plan, in your own words; follow the candidate's answers deeper before moving to the next theme.`
      : ""

  const scoping =
    plan && plan.verifyTopics.length > 0
      ? ` Honest scoping (absolute): never state statutes, state rules, licensing requirements, or exam content as fact. In this session that covers: ${plan.verifyTopics.join(
          "; "
        )}. Probe how the candidate reasons about these and how they would verify with official sources; never quiz for a "correct" regulatory answer.`
      : ""

  const hooks =
    plan && plan.candidateHooks.length > 0
      ? ` From the candidate's background, worth probing directly: ${plan.candidateHooks.join(
          "; "
        )}. Raise these naturally, the way a prepared interviewer does ("I see you led X, tell me about that").`
      : ""

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have interviewed this candidate for "${role}" in an earlier session; do not introduce yourself as if meeting for the first time.`,
        open.length > 0
          ? ` They committed to: ${open.map((item) => item.text).join("; ")}. Follow up on these before anything new.`
          : "",
        delivered.length > 0
          ? ` They have already delivered: ${delivered.map((item) => item.text).join("; ")} — acknowledge briefly if relevant and do not ask again.`
          : "",
        continuity.lastSessionSummary
          ? ` Where the last session left off: ${continuity.lastSessionSummary}`
          : "",
      ]
    : []

  const startScript =
    open.length > 0
      ? `Good to see you again. Before we get into new ground — last time you said you'd ${spokenCommitment(open[0])}. Where did that land?`
      : plan && plan.candidateHooks.length > 0
        ? `Thanks for coming in. I've gone through the role and your background, and I've got a plan for our time. Let's start simple — tell me about yourself and what's drawing you to this role.`
        : `Thanks for coming in. Let's start simple — tell me about yourself and what's drawing you to this role.`

  return {
    personalityPreamble:
      composeWithinBudget([framing, ...continuityContext, planSection, scoping, hooks]) + "\n\n",
    startScript,
  }
}
