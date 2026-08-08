import {
  scopeList,
  scopeText,
  type AuditPromptInput,
  type OrchestratePromptInput,
  type ReportPromptInput,
  type Scope,
} from "../types.ts"
import { areaByLabel, DEFAULT_AREA, type ControlArea } from "./catalog.ts"

// The audit lane's OpenAI prompts. Same JSON contracts as the other lanes
// (shared grounding pipeline and schema); the substance is audit-interview
// readiness. Two absolute rules run through every prompt: safeguards come
// ONLY from the injected catalog restatements — the model must never cite a
// framework from its own knowledge — and every output is practice-readiness
// feedback, never a compliance determination. Pin tests hold both in place.

const areaOf = (scope: Scope): ControlArea =>
  areaByLabel(scopeText(scope, "controlArea")) ?? DEFAULT_AREA

const safeguardLines = (area: ControlArea): string =>
  area.safeguards
    .map(
      (s) =>
        `- Safeguard ${s.id} (${s.ig}) ${s.title}: ${s.restatement} Evidence an assessor asks for: ${s.evidence.join("; ")}.`
    )
    .join("\n")

const scopeBlock = (scope: Scope) =>
  `- Being assessed: ${scopeText(scope, "systemName")}
- Environment: ${scopeText(scope, "description")}
- The auditee's role: ${scopeText(scope, "role")}
- Session control area: ${areaOf(scope).label}
- Where they feel least ready: ${scopeList(scope, "concerns").join(", ") || "(not stated)"}`

export const analyzeSystem = `You are a lead security assessor preparing for an audit interview. Extract structured context from the auditee's scope. Return JSON only with these fields: environmentProfile, controlOwnership, evidencePosture, riskiestArea, likelyFindings, openQuestions. Each field is a string. openQuestions holds 3 to 6 questions the assessor still needs answered, each phrased as a real question ending with a question mark — not a list of documents to provide. Base every field ONLY on what the auditee provided — where they gave nothing, say plainly what is missing rather than inventing content. This is practice preparation, not a compliance determination.`

export const analyzeUser = (scope: Scope) =>
  `Being assessed: ${scopeText(scope, "systemName")}\nEnvironment: ${scopeText(scope, "description")}\nAuditee role: ${scopeText(scope, "role")}\nSession control area: ${areaOf(scope).label}\nSafeguards in scope:\n${safeguardLines(areaOf(scope))}\nStated concerns: ${scopeList(scope, "concerns").join(", ")}`

export const audit = ({ scope, unreadableCount, materialSections }: AuditPromptInput) => {
  const area = areaOf(scope)
  return `You are a lead security assessor doing the document pre-read before an audit interview practice session.

The auditee's scope (their own words, NOT evidence):
${scopeBlock(scope)}

The safeguards in scope for this session. These restatements are the ONLY control content you may use — never cite any other framework, standard, control, or safeguard number, and never quote standard text:
${safeguardLines(area)}
${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available as evidence.\n` : ""}
The materials (the ONLY citable evidence). Location markers look like [page 3], [slide 2], [sheet Backups]:

${materialSections}

Every claim and gap is tagged with the readiness axis it bears on:
"process" (a documented procedure exists and is current), "evidence" (records prove it actually happened), "command" (the documents show who owns it and how it works), "cadence" (the required frequency is met — schedules, review dates, test dates).

TASK 1 — CLAIMS. List what the materials concretely establish against the safeguards in scope (procedures that exist, schedules configured, tests run, reviews dated). For each: "text" (the claim, under 20 words), "source" (the exact file name), "location" (a marker that appears in that file, e.g. "page 2", "slide 1"; use "document" for files without markers), "axis". Only include claims you can point to in the materials. If the materials are thin, few or zero claims is the correct answer — do not invent.

TASK 2 — GAPS. What an assessor preparing on these safeguards expects and cannot find. Each: "severity" ("blocker" = the interview will stall on this; "gap" = weakens readiness), "kind" ("absent" = expected but in no material; "unsupported" = stated with no backing record), "title" (under 8 words), "detail" (under 25 words), "axis". 3 to 8 gaps, each traceable to a safeguard in scope.

Return JSON only: {"claims":[{"text","source","location","axis"}],"gaps":[{"severity","kind","title","detail","axis"}]}`
}

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  scope,
  current,
}: OrchestratePromptInput) => {
  const area = areaOf(scope)
  return `You are observing a live audit interview practice session and scoring the auditee in real time alongside ${characterName} (${characterRole}).

Session context:
${scopeBlock(scope)}

The safeguards in scope. These restatements are the ONLY control content you may use — never cite any other framework, standard, or safeguard number:
${safeguardLines(area)}

${characterName}'s evaluation lens (guides which risks you watch hardest, but you MUST score all four):
${characterTone}

Risk dimensions, each scored 0-100 (0 = no concern, 100 = critical risk):
- process: is there a real, current, documented procedure behind each answer
- evidence: can they point to records, or only to assurances
- command: do they actually know how it works — names, tools, numbers, without hedging
- cadence: do required frequencies actually happen — backups run, reviews dated, tests recent

Current scores:
- process=${current.process}
- evidence=${current.evidence}
- command=${current.command}
- cadence=${current.cadence}

CRITICAL RULES — read carefully:
1. Assess each of the four dimensions INDEPENDENTLY. Do NOT apply a single overall judgment to all four.
2. For each dimension, ask: "did the most recent turn in this conversation touch THIS specific dimension?"
   - If NO: return the CURRENT value UNCHANGED (exact same integer).
   - If YES: adjust the score by between 1 and 8 points (in either direction) based on the answer's quality on THAT specific dimension.
3. In most turns, only 1 or 2 dimensions will be touched. The other 2-3 should be UNCHANGED.
4. Specific, dated, record-backed auditee answers DECREASE the relevant dimension.
5. Vague answers, "usually", "we're planning to", or assurances without records INCREASE the relevant dimension.
6. Whole integers, 0-100 only. Never move by more than 10 points in a single turn.

Also produce ONE short observation (8-18 words) about the most recent auditee turn. Classify it:
- strong_answer: auditee gave a specific, record-backed answer
- weak_assumption: auditee asserted something no record supports
- objection: the assessor pushed back or asked to see proof
- follow_up: a question still hanging
- event: a notable shift in tone or topic

Respond with JSON only, exactly this shape:
{"riskScores":{"process":int,"evidence":int,"command":int,"cadence":int},"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"}}`
}

const engagementBlock = (continuity: ReportPromptInput["continuity"]): string =>
  continuity
    ? `\nThe engagement so far (memory going into this session):
Previous summary: ${continuity.summary || "(none)"}
Commitments already tracked — open: ${continuity.open.join("; ") || "(none)"}; delivered: ${continuity.delivered.join("; ") || "(none)"}
`
    : ""

export const report = ({
  scope,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
  continuity,
}: ReportPromptInput) => {
  const area = areaOf(scope)
  return `You are a lead assessor writing up an audit interview practice session.

The auditee's scope:
${scopeBlock(scope)}

The safeguards in scope. These restatements are the ONLY control content you may reference — never cite any other framework, standard, control, or safeguard number:
${safeguardLines(area)}
${engagementBlock(continuity)}
Assessor who ran the session: ${characterName} (${characterRole})
Assessor's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce a comprehensive readiness verdict and report. Return JSON ONLY with this exact shape:
{
  "verdict": {
    "decision": "ready" | "shaky" | "not-ready",
    "summary": "one-sentence rationale",
    "confidence": <integer 0-100>
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the auditee, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "overallScore": <integer 0-100, higher is better>,
  "executiveSummary": "<3-4 sentences synthesizing the session>",
  "panelVerdict": {
    "verdict": "<one short phrase capturing the assessor's take>",
    "score": <integer 0-100>,
    "reasoning": "<2-3 sentences from the assessor's perspective>"
  },
  "topRisks": ["<a finding an assessor would raise, tied to a safeguard in scope, short>", "<...>", "<...>"],
  "heldUp": [
    {"finding": "<a statement the AUDITEE made that stood up — specific, dated, or record-backed — restated in one short sentence with nothing added>",
     "quote": "<the auditee's exact words from the transcript, copied verbatim>"}
  ],
  "nextSevenDays": [
    {"day": 1, "task": "<concrete preparation action>", "priority": "high"|"medium"|"low"},
    {"day": 2, "task": "<...>", "priority": "..."},
    {"day": 3, "task": "<...>", "priority": "..."},
    {"day": 4, "task": "<...>", "priority": "..."},
    {"day": 5, "task": "<...>", "priority": "..."},
    {"day": 6, "task": "<...>", "priority": "..."},
    {"day": 7, "task": "<...>", "priority": "..."}
  ],
  "continuity": {
    "summary": "<2-4 sentences a colleague could read before the next session: where readiness stands, what was proven, what remains contested>",
    "actionItems": ["<a commitment the auditee made or a record this session showed is missing — starts with a verb, under 15 words>"]
  }
}

ABSOLUTE LANGUAGE RULE: this is practice-readiness feedback for an interview rehearsal. Never state or imply a compliance determination, certification status, pass/fail against any framework, or audit opinion. Readiness language only.

Be concrete and specific. Each risk/task should trace to a safeguard in scope and something said in THIS session, not generic advice.

"continuity" is the engagement's compounding memory, not a session note. For the summary: UPDATE the previous summary rather than writing a fresh one — carry forward the durable facts and the arc of the engagement (records produced, dates named, owners identified, what's been proven), fold in what this session changed, and drop only what is fully resolved. A detail from an earlier session that still matters belongs in the summary even if this session never mentioned it. Each action item will be read back to the auditee as "last time you said you'd …". 0 to 5 items; never repeat or rephrase a commitment already tracked as open or delivered; if nothing new emerged, return an empty list — never invent a commitment.

Grounding rules (absolute):
- "heldUp" may contain ONLY statements the auditee actually made that stood up to the assessor (records named, dates given, processes described concretely), each with their verbatim words in "quote". An admission that something is missing or untested is NOT a statement that held up — leave it out. If nothing stood up, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "nextSevenDays", never in "heldUp".
- Nowhere in the report state specifics the transcript does not contain (tools, dates, frequencies, owners). Where the auditee provided nothing, say so plainly.`
}
