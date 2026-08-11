import {
  scopeList,
  scopeText,
  type AuditPromptInput,
  type DebriefPromptInput,
  type OrchestratePromptInput,
  type Scope,
} from "../types.ts"

// The founder lane's OpenAI prompts, moved out of the Convex actions that
// inlined them (simulations, audits, orchestrator, debriefs). The pin
// tests in prompts.test.ts hold the load-bearing lines in place; edit those
// tests deliberately when the prompt itself is meant to change.

export const analyzeSystem = `You are a business analyst. Extract structured context from a startup brief. Return JSON only with these fields: problem, targetCustomer, coreAssumption, revenueModel, primaryRisk, competitors, openQuestions. Each field is a string.`

export const analyzeUser = (scope: Scope) =>
  `Idea: ${scopeText(scope, "ideaName")}\nStage: ${scopeText(scope, "stage")}\nDescription: ${scopeText(scope, "description")}\nTarget User: ${scopeText(scope, "targetUser")}\nBusiness Model: ${scopeText(scope, "businessModel")}\nFocus Areas: ${scopeList(scope, "focusAreas").join(", ")}`

export const extractScope = ({ source, pitch }: { source: "voice" | "deck"; pitch: string }) =>
  `You turn a founder's ${source === "voice" ? "spoken pitch transcript" : "pitch deck text"} into a structured brief. This is extraction only, from what the founder actually said.

THE HONESTY RULE: extract ONLY what the founder actually said. If a field is not clearly present, return null for it. A thin or vague pitch should produce mostly nulls. Never infer, never fill in plausible content, never polish vagueness into specifics. A missing answer is valuable information, not a gap for you to close.

Fields:
- "ideaName": the product or company name, only if stated.
- "description": what it is and does, 1-3 sentences using the founder's own substance (you may fix grammar, not add facts).
- "whyNow": why this is the moment, only if the founder addressed timing.
- "stage": exactly one of "Idea" | "Prototype" | "MVP" | "Beta" | "Early revenue" | "Growth / Series A+", copied verbatim, only if stated or unmistakable.
- "businessModel": exactly one of "SaaS · per-seat" | "SaaS · usage-based" | "SaaS · tiered" | "Marketplace" | "Ad-supported" | "One-time" | "Freemium" | "Enterprise", copied verbatim, only if stated.
- "targetUser": exactly one of "SMB founders" | "Mid-market product leaders" | "Enterprise buyers" | "B2B SaaS (Series B+)" | "Developers" | "Designers and creators" | "Consumer audiences", copied verbatim, only if the audience clearly matches one.
- "focusAreas": an array drawn from "Market need" | "Willingness to pay" | "Technical feasibility" | "Competition" | "Go-to-market" | "Pricing" | "User experience" | "Fundraising story", each copied verbatim, only where the founder named it as a worry. null if they named none.

Every value is a string except "focusAreas", which is an array of strings. A chip field that does not match a listed label verbatim is null. Never use an em dash in any output value.

Return JSON only, keyed exactly: {"ideaName","description","whyNow","stage","businessModel","targetUser","focusAreas"} with null for anything not said.

The pitch:
${pitch.slice(0, 12_000)}`

export const audit = ({ scope, unreadableCount, materialSections }: AuditPromptInput) =>
  `You are a diligence analyst auditing a founder's materials before a panel session.

The founder's brief (their own words, NOT evidence):
- Idea: ${scopeText(scope, "ideaName")}
- Stage: ${scopeText(scope, "stage")}
- Description: ${scopeText(scope, "description")}
- Target user: ${scopeText(scope, "targetUser")}
- Business model: ${scopeText(scope, "businessModel")}
${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available as evidence.\n` : ""}
The materials (the ONLY citable evidence). Location markers look like [page 3], [slide 2], [sheet ARR]:

${materialSections}

TASK 1 — CLAIMS. List the concrete, diligence-relevant claims the materials actually make (metrics, traction, market size, pricing, technology). For each: "text" (the claim, under 20 words), "source" (the exact file name), "location" (a marker that appears in that file, e.g. "page 2", "slide 1", "sheet ARR"; use "document" for files without markers). Only include claims you can point to in the materials. If the materials are thin, few or zero claims is the correct answer — do not invent.

TASK 2 — GAPS. What a competent diligencer expects but cannot find. Each: "severity" ("blocker" = would stall a real process; "gap" = weakens the story), "kind" ("absent" = expected but in no material; "unsupported" = stated in the brief or materials with no backing evidence), "title" (under 8 words), "detail" (under 25 words). 3 to 8 gaps.

Return JSON only: {"claims":[{"text","source","location"}],"gaps":[{"severity","kind","title","detail"}]}`

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  scope,
}: OrchestratePromptInput) =>
  `You are observing a live founder pitch alongside ${characterName} (${characterRole}), taking notes in real time.

Pitch context:
- Idea: ${scopeText(scope, "ideaName")}
- Description: ${scopeText(scope, "description")}
- Target user: ${scopeText(scope, "targetUser")}
- Business model: ${scopeText(scope, "businessModel")}

${characterName}'s evaluation lens (guides what you watch hardest):
${characterTone}

What you listen for: TAM, demand intensity and timing on the market; pain severity, willingness to pay and switching cost on the customer; feasibility, scalability and accuracy/latency claims on the technical side; distribution, sales motion and channel risk on go-to-market. A strong answer is sharp, specific, and evidence-backed. A weak one is vague, hand-wavy, or leans on a claim that won't hold up.

Produce ONE short observation (8-18 words) about the most recent founder turn, or null if the turn contains nothing worth noting. Classify it:
- strong_answer: founder gave a sharp, specific answer. Only when their own words demonstrably earn it; when unsure, no note
- weak_assumption: founder relied on a claim that won't hold up
- objection: panelist pushed back on something
- follow_up: a question still hanging
- event: a notable shift in tone or topic

Also name the topic being discussed right now, in 5 words or fewer (e.g. "pricing power", "churn math"). Use null if it is unclear.

Respond with JSON only, exactly this shape:
{"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"} | null,"topic":"<5 words or fewer>" | null}`

const engagementBlock = (continuity: DebriefPromptInput["continuity"]): string =>
  continuity
    ? `\nThe engagement so far (memory going into this session):
Previous summary: ${continuity.summary || "(none)"}
Commitments already tracked — open: ${continuity.open.join("; ") || "(none)"}; delivered: ${continuity.delivered.join("; ") || "(none)"}
`
    : ""

export const debrief = ({
  scope,
  characterName,
  characterRole,
  characterTone,
  notes,
  transcript,
  continuity,
}: DebriefPromptInput) =>
  `You are a senior advisor synthesizing a founder panel session into a debrief.

Brief:
- Idea: ${scopeText(scope, "ideaName")}
- Description: ${scopeText(scope, "description")}
- Target user: ${scopeText(scope, "targetUser")}
- Business model: ${scopeText(scope, "businessModel")}
${engagementBlock(continuity)}
Panelist who ran the session: ${characterName} (${characterRole})
Panelist's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce the debrief. Return JSON ONLY with this exact shape:
{
  "title": "<a 2-4 word name for this session, e.g. \\"Evidence on request\\">",
  "verdict": {
    "decision": "advance" | "iterate" | "pass",
    "summary": "one-sentence rationale"
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the founder, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "whatHappened": "<one paragraph, 60-120 words, addressed to the founder in the second person (\\"You confirmed…\\") — concrete about what this session covered, what was established, and where it broke down>",
  "heldUp": [
    {"quote": "<the founder's exact words from the transcript, copied verbatim>",
     "why": "<one line on why it landed>"}
  ],
  "didntHold": [
    {"text": "<something missing or unproven that the session exposed, short>", "ref": null}
  ],
  "continuity": {
    "summary": "<2-4 sentences a colleague could read before the next session: where the pitch stands, what was resolved, what remains contested>",
    "actionItems": [
      {"text": "<a commitment the founder made or a deliverable this session showed is missing — starts with a verb, under 15 words>", "priority": "high" | "medium" | "low"}
    ]
  }
}

"heldUp" holds 0 to 3 items; "didntHold" holds 0 to 4. "ref" is always null in this lane. Be concrete and specific: every line should mention something tied to THIS founder's idea, not generic advice.

"continuity" is the engagement's compounding memory, not a session note. For the summary: UPDATE the previous summary rather than writing a fresh one — carry forward the durable facts and the arc of the engagement (numbers, decisions, who's involved, what's been proven), fold in what this session changed, and drop only what is fully resolved. A detail from an earlier session that still matters belongs in the summary even if this session never mentioned it. Each action item will be read back to the founder as "last time you said you'd …". 0 to 5 items; never repeat or rephrase a commitment already tracked as open or delivered; if nothing new emerged, return an empty list — never invent a commitment.

CALIBRATION. The founder's trust depends on honest feedback; never inflate:
- Judge only what the transcript shows. Every sentence of "whatHappened" must trace to actual turns; never credit intent, effort, or content that did not occur.
- If the founder said little or nothing, "whatHappened" is one plain sentence saying exactly that, the decision is "pass", and "spokenVerdict" is ${characterName}'s honest reaction to the non-engagement. "spokenVerdict" is always a judgment of the founder's performance, never a restatement of a question ${characterName} asked.
- Verdicts are earned: "advance" only when the transcript demonstrates it. Torn between two tiers? Choose the lower.
- "didntHold" names what actually went wrong in THIS conversation, not a best-practices checklist. Two real findings beat four generic ones.
- Write plainly. Never use em dashes in any output field.

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative claims the founder actually stated that withstood the panel's scrutiny (evidence, numbers, commitments), each quoted verbatim in "quote". An admission that something is missing, untested, or unknown is NOT a claim that held up — leave it out. If the founder made no defensible claims, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "continuity" action items, never in "heldUp".
- Nowhere in the debrief state specifics the transcript does not contain (numbers, buyer types, technologies, market sizes). Where the founder provided nothing, say so plainly.`
