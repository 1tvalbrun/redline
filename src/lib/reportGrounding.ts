import { asString, field } from "./audit.ts"

// Grounding for the report's "held up" findings, the same discipline
// groundAudit applies to claims: a finding the founder cannot be quoted on
// cannot be constructed. The model proposes {finding, quote} candidates;
// only those whose quote is verbatim founder speech survive. Zero survivors
// is a legitimate report — a founder who made no defensible claims has
// nothing that held up.
export type HeldUpFinding = { finding: string; quote: string }

export const MAX_HELD_UP = 5

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

export const groundHeldUp = (raw: unknown, founderTurns: string[]): HeldUpFinding[] => {
  const speech = normalize(founderTurns.join("\n"))
  if (!speech) return []

  const candidates: unknown[] = Array.isArray(raw) ? raw.slice(0, MAX_HELD_UP) : []
  const findings: HeldUpFinding[] = []
  for (const entry of candidates) {
    const finding = asString(field(entry, "finding"))
    const quote = asString(field(entry, "quote"))
    if (!finding || !quote) continue
    const normalizedQuote = normalize(quote)
    // A one- or two-word quote grounds nothing — "yeah" can't carry a claim.
    if (normalizedQuote.split(" ").length < 3) continue
    if (!speech.includes(normalizedQuote)) continue
    findings.push({ finding, quote })
  }
  return findings
}
