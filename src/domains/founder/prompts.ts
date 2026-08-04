import {
  BUSINESS_MODEL_OPTIONS,
  STAGE_OPTIONS,
  TARGET_OPTIONS,
} from "../../lib/briefOptions.ts"
import type {
  AuditPromptInput,
  Brief,
  OrchestratePromptInput,
  ReportPromptInput,
} from "../types.ts"

// The founder lane's OpenAI prompts, moved verbatim from the Convex actions
// that inlined them (simulations, audits, orchestrator, reports). The pin
// tests in prompts.test.ts hold the load-bearing lines in place; edit those
// tests deliberately when the prompt itself is meant to change.

export const analyzeSystem = `You are a business analyst. Extract structured context from a startup brief. Return JSON only with these fields: problem, targetCustomer, coreAssumption, revenueModel, primaryRisk, competitors, openQuestions. Each field is a string.`

export const analyzeUser = (brief: Brief) =>
  `Idea: ${brief.ideaName}\nStage: ${brief.stage}\nDescription: ${brief.description}\nTarget User: ${brief.targetUser}\nBusiness Model: ${brief.businessModel}\nFocus Areas: ${brief.focusAreas.join(", ")}`

export const extractBrief = ({ source, pitch }: { source: "voice" | "deck"; pitch: string }) => {
  const stageValues = STAGE_OPTIONS.map((o) => o.value).join(" | ")
  const modelValues = BUSINESS_MODEL_OPTIONS.map((o) => `${o.value} (${o.label})`).join(", ")
  const targetValues = TARGET_OPTIONS.map((o) => `${o.value} (${o.label})`).join(", ")

  return `You turn a founder's ${source === "voice" ? "spoken pitch transcript" : "pitch deck text"} into a structured brief.

THE HONESTY RULE: extract ONLY what the founder actually said. If a field is not clearly present, return null for it. A thin or vague pitch should produce mostly nulls. Never infer, never fill in plausible content, never polish vagueness into specifics.

Fields:
- "ideaName": the product or company name, only if stated.
- "description": what it is and does, 1-3 sentences using the founder's own substance (you may fix grammar, not add facts).
- "whyNow": why this is the moment, only if the founder addressed timing.
- "stage": one of ${stageValues} — only if stated or unmistakable.
- "businessModel": one of these values, only if stated: ${modelValues}.
- "targetUser": one of these values, only if the audience clearly matches one: ${targetValues}.

Return JSON only: {"ideaName","description","whyNow","stage","businessModel","targetUser"} with null for anything not present.

The pitch:
${pitch.slice(0, 12_000)}`
}

export const audit = ({ brief, unreadableCount, materialSections }: AuditPromptInput) =>
  `You are a diligence analyst auditing a founder's materials before a panel session.

The founder's brief (their own words, NOT evidence):
- Idea: ${brief.ideaName}
- Stage: ${brief.stage}
- Description: ${brief.description}
- Target user: ${brief.targetUser}
- Business model: ${brief.businessModel}
${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available as evidence.\n` : ""}
The materials (the ONLY citable evidence). Location markers look like [page 3], [slide 2], [sheet ARR]:

${materialSections}

Every claim and gap is tagged with the diligence axis it bears on:
"market" (TAM, demand, timing), "customer" (pain severity, willingness to pay, switching cost), "technical" (feasibility, reliability, scalability), "gtm" (distribution, sales motion, pricing execution).

TASK 1 — CLAIMS. List the concrete, diligence-relevant claims the materials actually make (metrics, traction, market size, pricing, technology). For each: "text" (the claim, under 20 words), "source" (the exact file name), "location" (a marker that appears in that file, e.g. "page 2", "slide 1", "sheet ARR"; use "document" for files without markers), "axis". Only include claims you can point to in the materials. If the materials are thin, few or zero claims is the correct answer — do not invent.

TASK 2 — GAPS. What a competent diligencer expects but cannot find. Each: "severity" ("blocker" = would stall a real process; "gap" = weakens the story), "kind" ("absent" = expected but in no material; "unsupported" = stated in the brief or materials with no backing evidence), "title" (under 8 words), "detail" (under 25 words), "axis". 3 to 8 gaps.

Return JSON only: {"claims":[{"text","source","location","axis"}],"gaps":[{"severity","kind","title","detail","axis"}]}`

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  brief,
  current,
}: OrchestratePromptInput) =>
  `You are observing a live founder pitch and scoring it in real time alongside ${characterName} (${characterRole}).

Pitch context:
- Idea: ${brief.ideaName}
- Description: ${brief.description}
- Target user: ${brief.targetUser}
- Business model: ${brief.businessModel}

${characterName}'s evaluation lens (guides which risks you watch hardest, but you MUST score all four):
${characterTone}

Risk dimensions, each scored 0-100 (0 = no concern, 100 = critical risk):
- market: TAM, demand intensity, market timing
- customer: pain severity, willingness to pay, switching cost
- technical: feasibility, scalability, accuracy/latency claims
- gtm: distribution, sales motion, channel risk

Current scores:
- market=${current.market}
- customer=${current.customer}
- technical=${current.technical}
- gtm=${current.gtm}

CRITICAL RULES — read carefully:
1. Assess each of the four dimensions INDEPENDENTLY. Do NOT apply a single overall judgment to all four.
2. For each dimension, ask: "did the most recent turn in this conversation touch THIS specific dimension?"
   - If NO: return the CURRENT value UNCHANGED (exact same integer).
   - If YES: adjust the score by between 1 and 8 points (in either direction) based on the answer's quality on THAT specific dimension.
3. In most turns, only 1 or 2 dimensions will be touched. The other 2-3 should be UNCHANGED.
4. Strong, specific, evidence-backed founder answers DECREASE the relevant dimension.
5. Vague, dodgy, hand-wavy, or unsupported claims INCREASE the relevant dimension.
6. Whole integers, 0-100 only. Never move by more than 10 points in a single turn.

Also produce ONE short observation (8-18 words) about the most recent founder turn. Classify it:
- strong_answer: founder gave a sharp, specific answer
- weak_assumption: founder relied on a claim that won't hold up
- objection: panelist pushed back on something
- follow_up: a question still hanging
- event: a notable shift in tone or topic

Respond with JSON only, exactly this shape:
{"riskScores":{"market":int,"customer":int,"technical":int,"gtm":int},"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"}}`

export const report = ({
  brief,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
}: ReportPromptInput) =>
  `You are a senior advisor synthesizing a founder panel session into a final report.

Brief:
- Idea: ${brief.ideaName}
- Description: ${brief.description}
- Target user: ${brief.targetUser}
- Business model: ${brief.businessModel}

Panelist who ran the session: ${characterName} (${characterRole})
Panelist's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce a comprehensive verdict and report. Return JSON ONLY with this exact shape:
{
  "verdict": {
    "decision": "advance" | "iterate" | "pass",
    "summary": "one-sentence rationale",
    "confidence": <integer 0-100>
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the founder, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "overallScore": <integer 0-100, higher is better>,
  "executiveSummary": "<3-4 sentences synthesizing the session>",
  "panelVerdict": {
    "verdict": "<one short phrase capturing the panelist's take>",
    "score": <integer 0-100>,
    "reasoning": "<2-3 sentences from the panelist's perspective>"
  },
  "topRisks": ["<short risk>", "<short risk>", "<short risk>"],
  "heldUp": [
    {"finding": "<a claim the FOUNDER stated that survived the panel's pressure, restated in one short sentence with nothing added>",
     "quote": "<the founder's exact words from the transcript stating this claim, copied verbatim>"}
  ],
  "nextSevenDays": [
    {"day": 1, "task": "<concrete action>", "priority": "high"|"medium"|"low"},
    {"day": 2, "task": "<...>", "priority": "..."},
    {"day": 3, "task": "<...>", "priority": "..."},
    {"day": 4, "task": "<...>", "priority": "..."},
    {"day": 5, "task": "<...>", "priority": "..."},
    {"day": 6, "task": "<...>", "priority": "..."},
    {"day": 7, "task": "<...>", "priority": "..."}
  ]
}

Be concrete and specific. Each risk/task should mention something tied to THIS founder's idea, not generic advice.

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative claims the founder actually stated that withstood the panel's scrutiny (evidence, numbers, commitments), each with their verbatim words in "quote". An admission that something is missing, untested, or unknown is NOT a claim that held up — leave it out. If the founder made no defensible claims, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "nextSevenDays", never in "heldUp".
- Nowhere in the report state specifics the transcript does not contain (numbers, buyer types, technologies, market sizes). Where the founder provided nothing, say so plainly.`
