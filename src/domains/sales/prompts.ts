import {
  scopeList,
  scopeText,
  type AuditPromptInput,
  type OrchestratePromptInput,
  type ReportPromptInput,
  type Scope,
} from "../types.ts"
import { OBJECTIONS } from "./objections.ts"

// The sales lane's OpenAI prompts. Same JSON contracts as the founder
// lane's (the grounding pipeline and schema are shared engine); the
// substance is deal diligence, not investment diligence. Pin tests in
// prompts.test.ts hold the load-bearing lines in place.

const scopeBlock = (scope: Scope) =>
  `- Offering: ${scopeText(scope, "offering")}
- What it does: ${scopeText(scope, "description")}
- Prospect: ${scopeText(scope, "prospect")}
- The ask: ${scopeText(scope, "ask")}
- Objections the seller expects: ${scopeList(scope, "objections").join(", ") || "(none named)"}`

export const analyzeSystem = `You are a sales strategist. Extract structured context from a seller's pitch scope. Return JSON only with these fields: coreOffer, buyerProfile, valueProposition, pricingShape, riskiestAssumption, likelyObjections, openQuestions. Each field is a string. Base every field ONLY on what the seller provided — where they gave nothing, say plainly what is missing rather than inventing content.`

export const analyzeUser = (scope: Scope) =>
  `Offering: ${scopeText(scope, "offering")}\nWhat it does: ${scopeText(scope, "description")}\nProspect: ${scopeText(scope, "prospect")}\nThe ask: ${scopeText(scope, "ask")}\nExpected objections: ${scopeList(scope, "objections").join(", ")}`

export const audit = ({ scope, unreadableCount, materialSections }: AuditPromptInput) =>
  `You are a deal-diligence analyst auditing a seller's materials before a live pitch session.

The seller's scope (their own words, NOT evidence):
${scopeBlock(scope)}
${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available as evidence.\n` : ""}
The materials (the ONLY citable evidence). Location markers look like [page 3], [slide 2], [sheet Pricing]:

${materialSections}

Every claim and gap is tagged with the deal axis it bears on:
"value" (problem severity, quantified payoff, ROI), "fit" (right buyer, right operation, right timing), "objections" (switching cost, integration, trust, references), "close" (the ask, pricing clarity, a concrete next step).

TASK 1 — CLAIMS. List the concrete, buyer-relevant claims the materials actually make (outcomes, numbers, pricing, customers, integrations). For each: "text" (the claim, under 20 words), "source" (the exact file name), "location" (a marker that appears in that file, e.g. "page 2", "slide 1"; use "document" for files without markers), "axis". Only include claims you can point to in the materials. If the materials are thin, few or zero claims is the correct answer — do not invent.

TASK 2 — GAPS. What a skeptical buyer expects and cannot find. Each: "severity" ("blocker" = would stall a real deal; "gap" = weakens the pitch), "kind" ("absent" = expected but in no material; "unsupported" = stated in the scope or materials with no backing evidence), "title" (under 8 words), "detail" (under 25 words), "axis". 3 to 8 gaps.

Return JSON only: {"claims":[{"text","source","location","axis"}],"gaps":[{"severity","kind","title","detail","axis"}]}`

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  scope,
  current,
}: OrchestratePromptInput) =>
  `You are observing a live sales pitch and scoring it in real time alongside ${characterName} (${characterRole}).

Pitch context:
${scopeBlock(scope)}

${characterName}'s evaluation lens (guides which risks you watch hardest, but you MUST score all four):
${characterTone}

Common buyer objections and how they sound when pressed:
${OBJECTIONS.map((objection) => `- ${objection.label}: "${objection.probe}"`).join("\n")}

Risk dimensions, each scored 0-100 (0 = no concern, 100 = critical risk):
- value: problem severity, quantified payoff, ROI story
- fit: right buyer, right operation, right timing
- objections: switching cost, integration, trust, references — did answers survive pushback
- close: clarity of the ask, pricing confidence, momentum toward a concrete next step

Current scores:
- value=${current.value}
- fit=${current.fit}
- objections=${current.objections}
- close=${current.close}

CRITICAL RULES — read carefully:
1. Assess each of the four dimensions INDEPENDENTLY. Do NOT apply a single overall judgment to all four.
2. For each dimension, ask: "did the most recent turn in this conversation touch THIS specific dimension?"
   - If NO: return the CURRENT value UNCHANGED (exact same integer).
   - If YES: adjust the score by between 1 and 8 points (in either direction) based on the answer's quality on THAT specific dimension.
3. In most turns, only 1 or 2 dimensions will be touched. The other 2-3 should be UNCHANGED.
4. Strong, specific, evidence-backed seller answers DECREASE the relevant dimension.
5. Vague, dodgy, hand-wavy, or unsupported claims INCREASE the relevant dimension.
6. Whole integers, 0-100 only. Never move by more than 10 points in a single turn.

Also produce ONE short observation (8-18 words) about the most recent seller turn. Classify it:
- strong_answer: seller gave a sharp, specific answer
- weak_assumption: seller relied on a claim that won't hold up
- objection: the buyer pushed back on something
- follow_up: a question still hanging
- event: a notable shift in tone or topic

Respond with JSON only, exactly this shape:
{"riskScores":{"value":int,"fit":int,"objections":int,"close":int},"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"}}`

export const report = ({
  scope,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
}: ReportPromptInput) =>
  `You are a sales coach synthesizing a live pitch session into a deal-readiness report.

The seller's scope:
${scopeBlock(scope)}

Buyer who ran the session: ${characterName} (${characterRole})
Buyer's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce a comprehensive verdict and report. Return JSON ONLY with this exact shape:
{
  "verdict": {
    "decision": "buy" | "second-meeting" | "walk",
    "summary": "one-sentence rationale",
    "confidence": <integer 0-100>
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the seller, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "overallScore": <integer 0-100, higher is better>,
  "executiveSummary": "<3-4 sentences synthesizing the session>",
  "panelVerdict": {
    "verdict": "<one short phrase capturing the buyer's take>",
    "score": <integer 0-100>,
    "reasoning": "<2-3 sentences from the buyer's perspective>"
  },
  "topRisks": ["<an objection or gap that broke the pitch, short>", "<...>", "<...>"],
  "heldUp": [
    {"finding": "<a claim the SELLER stated that survived the buyer's pressure, restated in one short sentence with nothing added>",
     "quote": "<the seller's exact words from the transcript stating this claim, copied verbatim>"}
  ],
  "nextSevenDays": [
    {"day": 1, "task": "<concrete follow-up action>", "priority": "high"|"medium"|"low"},
    {"day": 2, "task": "<...>", "priority": "..."},
    {"day": 3, "task": "<...>", "priority": "..."},
    {"day": 4, "task": "<...>", "priority": "..."},
    {"day": 5, "task": "<...>", "priority": "..."},
    {"day": 6, "task": "<...>", "priority": "..."},
    {"day": 7, "task": "<...>", "priority": "..."}
  ]
}

Judge the close honestly: if the session ended without a specific, scheduled next step, say so in the executive summary and reflect it in the score — "send me some info" is not a next step.

Be concrete and specific. Each risk/task should mention something tied to THIS seller's offering and prospect, not generic advice.

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative claims the seller actually stated that withstood the buyer's scrutiny (evidence, numbers, commitments), each with their verbatim words in "quote". An admission that something is missing, untested, or unknown is NOT a claim that held up — leave it out. If the seller made no defensible claims, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "nextSevenDays", never in "heldUp".
- Nowhere in the report state specifics the transcript does not contain (numbers, buyer types, integrations, prices). Where the seller provided nothing, say so plainly.`
