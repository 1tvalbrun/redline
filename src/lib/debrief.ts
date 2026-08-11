import { asString, field } from "./audit.ts"

// Parse and bound the debrief model output. Same discipline as groundAudit:
// anything malformed degrades to a safe fallback instead of throwing —
// a session that ended deserves a debrief even when the model misbehaves.

export type DebriefPriority = "high" | "medium" | "low"

export type DebriefContent = {
  title: string
  verdict: string
  verdictSummary: string
  spokenVerdict: string
  whatHappened: string
  heldUp: { quote: string; why: string }[]
  didntHold: { text: string; ref?: string }[]
  continuity: {
    summary: string
    actionItems: { text: string; priority: DebriefPriority }[]
  }
}

export type ParseDebriefOptions = {
  verdictValues: string[]
  fallbackVerdict: string
  // The pack's worst tier — the participation floor lands here.
  lowestVerdict: string
  userTurns: string[]
}

// Below this, the session carries too little signal to rate: less than a
// couple of spoken sentences. The floor is deterministic on purpose — no
// model output can rate non-engagement above the lowest tier, whatever
// the prompt says. Trust in the feedback depends on it.
const MIN_ENGAGED_WORDS = 20

const isMinimalParticipation = (userTurns: string[]): boolean =>
  userTurns.join(" ").split(/\s+/).filter(Boolean).length < MIN_ENGAGED_WORDS

const TITLE_CHARS = 60
const SUMMARY_CHARS = 400
const SPOKEN_CHARS = 220
const HAPPENED_CHARS = 1200
const WHY_CHARS = 200
const GAP_CHARS = 300
const REF_CHARS = 40
const MAX_HELD_UP = 3
const MAX_DIDNT_HOLD = 4
const CONTINUITY_SUMMARY_CHARS = 1200
const ACTION_ITEM_CHARS = 120
const MAX_ACTION_ITEMS = 5
const PRIORITIES: ReadonlySet<string> = new Set(["high", "medium", "low"])

// Matching must survive the model's cosmetic edits (case, curly quotes,
// punctuation, collapsed whitespace) without ever accepting paraphrase —
// any changed or added word still fails the substring check.
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

const clamp = (value: string, max: number) => value.trim().slice(0, max)

const groundedHeldUp = (
  raw: unknown,
  userTurns: string[]
): { quote: string; why: string }[] => {
  const speech = normalize(userTurns.join("\n"))
  if (!speech || !Array.isArray(raw)) return []
  const findings: { quote: string; why: string }[] = []
  for (const entry of raw) {
    if (findings.length >= MAX_HELD_UP) break
    const quote = asString(field(entry, "quote"))
    const why = asString(field(entry, "why"))
    if (!quote || !why) continue
    const normalizedQuote = normalize(quote)
    // A one- or two-word quote grounds nothing — "yeah" can't carry a claim.
    if (normalizedQuote.split(" ").length < 3) continue
    if (!speech.includes(normalizedQuote)) continue
    findings.push({ quote: quote.trim(), why: clamp(why, WHY_CHARS) })
  }
  return findings
}

export const parseDebrief = (raw: unknown, options: ParseDebriefOptions): DebriefContent => {
  const decisions = new Set(options.verdictValues)
  const rawVerdict = field(raw, "verdict")
  const proposedDecision = asString(field(rawVerdict, "decision"))
  const modelVerdict =
    proposedDecision && decisions.has(proposedDecision)
      ? proposedDecision
      : options.fallbackVerdict
  const modelSummary =
    modelVerdict === proposedDecision
      ? clamp(asString(field(rawVerdict, "summary")) ?? "Verdict pending review.", SUMMARY_CHARS)
      : "Verdict pending review."

  // Participation floor: an inflated verdict over a near-empty session is
  // replaced wholesale — an honest lowest-tier verdict keeps its summary.
  const floored = isMinimalParticipation(options.userTurns) && modelVerdict !== options.lowestVerdict
  const verdict = floored ? options.lowestVerdict : modelVerdict
  const verdictSummary = floored
    ? "The session ended with too little from you to assess."
    : modelSummary

  const spokenRaw = asString(field(raw, "spokenVerdict"))
  const spokenVerdict = clamp(
    spokenRaw && spokenRaw.trim().length > 0
      ? spokenRaw
      : `My verdict: ${verdict}. ${verdictSummary}`,
    SPOKEN_CHARS
  )

  const didntHoldRaw = field(raw, "didntHold")
  const didntHold = (Array.isArray(didntHoldRaw) ? didntHoldRaw : [])
    .slice(0, MAX_DIDNT_HOLD)
    .flatMap((entry) => {
      const text = asString(field(entry, "text"))
      if (!text) return []
      const ref = asString(field(entry, "ref"))
      return [{ text: clamp(text, GAP_CHARS), ...(ref ? { ref: clamp(ref, REF_CHARS) } : {}) }]
    })

  const continuityRaw = field(raw, "continuity")
  const actionItemsRaw = field(continuityRaw, "actionItems")
  const candidates = Array.isArray(actionItemsRaw) ? actionItemsRaw : []
  const considered = candidates.slice(0, MAX_ACTION_ITEMS)
  const actionItems = considered.flatMap((entry) => {
    const text = asString(field(entry, "text"))
    if (!text || text.trim().length === 0) return []
    const priority = asString(field(entry, "priority")) ?? ""
    return [
      {
        text: clamp(text, ACTION_ITEM_CHARS),
        priority: (PRIORITIES.has(priority) ? priority : "medium") as DebriefPriority,
      },
    ]
  })
  // Observability, same discipline as groundHeldUp's drop warning: the raw
  // model output isn't stored, so this log is the only evidence of whether
  // the model emits items the parser can't read (e.g. bare strings).
  // Compared against the considered slice so cap overflow never reads as
  // unparseable.
  if (considered.length > actionItems.length) {
    console.warn(
      `[parseDebrief] dropped ${considered.length - actionItems.length} unparseable action item(s):`,
      JSON.stringify(considered).slice(0, 500)
    )
  }

  return {
    title: clamp(asString(field(raw, "title")) || "Session debrief", TITLE_CHARS),
    verdict,
    verdictSummary,
    spokenVerdict,
    whatHappened: clamp(asString(field(raw, "whatHappened")) ?? "", HAPPENED_CHARS),
    heldUp: groundedHeldUp(field(raw, "heldUp"), options.userTurns),
    didntHold,
    continuity: {
      summary: clamp(asString(field(continuityRaw, "summary")) ?? "", CONTINUITY_SUMMARY_CHARS),
      actionItems,
    },
  }
}
