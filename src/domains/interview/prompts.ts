import {
  scopeList,
  scopeText,
  type BlueprintPromptInput,
  type BlueprintRefineInput,
  type DebriefPromptInput,
  type OrchestratePromptInput,
  type Scope,
} from "../types.ts"

// The interview lane's OpenAI prompts. Same JSON discipline as the other
// lanes; the substance is interview preparation, and every prompt that can
// touch regulated territory carries the honest-scoping backstop. Pin tests
// in prompts.test.ts hold the load-bearing lines in place.

const HONEST_SCOPING = `HONEST SCOPING (absolute): never state statutes, state rules, licensing requirements, or exam content as fact anywhere in your output, even if the candidate does. In regulated or licensed territory, probe how the candidate reasons and how they would verify with official sources; never quiz against a "correct" regulatory answer you supply.`

const scopeBlock = (scope: Scope) =>
  `- Role: ${scopeText(scope, "roleTitle")}
- Interview type: ${scopeText(scope, "interviewType") || "Full loop (mixed)"}
- Seniority: ${scopeText(scope, "seniority") || "(not stated)"}
- Industry context: ${scopeText(scope, "industryContext") || "(not stated)"}
- Where they want the pressure: ${scopeList(scope, "focusAreas").join(", ") || "(not stated)"}`

const jobPostingBlock = (scope: Scope) => {
  const posting = scopeText(scope, "jobPosting")
  return posting ? `\nThe job posting they pasted:\n${posting}\n` : ""
}

export const analyzeSystem = `You are an interview coach. Extract structured context from a candidate's practice-interview scope. Return JSON only with these fields: roleSummary, interviewShape, pressureAreas, riskiestGap, openQuestions. Each field is a string. Base every field ONLY on what the candidate provided — where they gave nothing, say plainly what is missing rather than inventing content.`

export const analyzeUser = (scope: Scope) =>
  `${scopeBlock(scope)}${jobPostingBlock(scope)}`

export const extractScope = ({ source, pitch }: { source: "voice" | "deck"; pitch: string }) =>
  `You turn a candidate's ${source === "voice" ? "spoken description" : "pasted text"} into a structured practice-interview scope. This is extraction only, from what the candidate actually said.

THE HONESTY RULE: extract ONLY what the candidate actually said. If a field is not clearly present, return null for it. A thin or vague description should produce mostly nulls. Never infer, never fill in plausible content, never polish vagueness into specifics. A missing answer is valuable information, not a gap for you to close.

Fields:
- "roleTitle": the role they want to practice interviewing for, in their own terms, only if stated.
- "interviewType": exactly one of "Screening call" | "Behavioral" | "Technical & scenarios" | "Full loop (mixed)", copied verbatim, only if the candidate said what kind of interview they're preparing for.
- "seniority": exactly one of "Entry" | "Mid" | "Senior" | "Leadership", copied verbatim, only if stated or unambiguous from their words.
- "industryContext": the company, industry, or regulatory context in their own terms (e.g. "regional hospital ICU"), only if stated.
- "focusAreas": an array drawn from "Motivation & fit" | "Career story" | "Behavioral stories" | "Ownership" | "Conflict" | "Technical depth" | "Scenario judgment" | "Communication", each copied verbatim, only where the candidate named where they want the pressure. null if they named none.
- "jobPosting": always null — a job posting is pasted, never spoken.

Every value is a string except "focusAreas", which is an array of strings. A chip field that does not match a listed label verbatim is null. Never use an em dash in any output value.

Return JSON only, keyed exactly: {"roleTitle","interviewType","seniority","industryContext","focusAreas","jobPosting"} with null for anything not said.

What they said:
${pitch.slice(0, 12_000)}`

export const blueprint = ({ scope, unreadableCount, materialSections }: BlueprintPromptInput) =>
  `You are the interview panel's preparer, building a role-specific interview blueprint before a live practice interview. The interviewer will work from this vetted plan instead of improvising domain facts live.

The candidate's scope (their own words):
${scopeBlock(scope)}
${jobPostingBlock(scope)}${unreadableCount > 0 ? `\n${unreadableCount} uploaded file(s) could not be read and are not available.\n` : ""}
The candidate's materials (resume, job description, or both; location markers look like [page 3]):

${materialSections}

Build the plan. Return JSON only:
{"themes":[{"title","detail"}],"clarifyingQuestions":["..."],"questionPlan":[{"theme","questions":[{"question","followUp"}]}],"rubric":[{"theme","strong","weak"}],"verifyTopics":["..."],"candidateHooks":["..."]}

THEMES — 3 to 6. Each: "title" under 8 words, "detail" one line under 25 words on what will be probed and why it is real for this role at this level. Themes must fit the interview type: a screening call probes motivation, career story, and fit; a behavioral loop probes stories, ownership, and conflict; a technical session probes domain scenarios and trade-offs; a full loop mixes them.

CLARIFYING QUESTIONS — 0 to 3 short strings, and zero is the normal answer. Ask ONLY when something load-bearing is missing (which state, which license type, IC or manager track). Never ask for detail that merely sharpens flavor.

QUESTION PLAN — for every theme, 2 to 4 questions, each with a "followUp" angle (what to press when the answer stays surface-level). Questions are asked aloud: plain speech, no numbering. Where the materials include a resume, ground questions in it when natural.

RUBRIC — for every theme: "strong" is one line on what a strong answer looks like, "weak" one line on what a weak one looks like, specific to this role and seniority.

VERIFY TOPICS — only when the role or industry touches licensed or regulated territory (law, medicine, insurance, finance, licensing exams, state rules): list the specific topics, under 12 words each, where facts must be verified with official sources. Otherwise an empty array.

CANDIDATE HOOKS — 0 to 4, drawn only from an actual resume in the materials: specific, quotable hooks (e.g. "Led the ICU float pool through the Epic migration"). Empty when no resume was provided.

${HONEST_SCOPING}

Never use an em dash in any output value. If the scope is thin, a smaller honest plan beats an invented one.`

export const refineBlueprint = ({
  scope,
  blueprint: current,
  removedThemes,
  redirectNote,
}: BlueprintRefineInput) => {
  const answers = current.clarifyingQuestions
    .filter((entry) => entry.answer)
    .map((entry) => `- ${entry.question} → ${entry.answer}`)
    .join("\n")
  return `You are revising an interview blueprint after the candidate reviewed it. This is the single refinement pass; the plan locks after this.

The candidate's scope:
${scopeBlock(scope)}

The current plan (JSON):
${JSON.stringify({
    themes: current.themes,
    questionPlan: current.questionPlan,
    rubric: current.rubric,
    verifyTopics: current.verifyTopics,
    candidateHooks: current.candidateHooks,
  })}

The candidate's input:
- Answers to your clarifying questions:
${answers || "(none)"}
- Themes they removed (do not bring these back, under any name): ${removedThemes.join("; ") || "(none)"}
- Redirect note: ${redirectNote || "(none)"}

Rebuild the plan honoring all three. Keep what still fits, sharpen what the answers unlock, drop the removed themes, and rebalance questions toward what remains. Return JSON only, the same shape as the current plan, plus "clarifyingQuestions": [] — always the empty array; there is no second round of questions:
{"themes":[{"title","detail"}],"clarifyingQuestions":[],"questionPlan":[{"theme","questions":[{"question","followUp"}]}],"rubric":[{"theme","strong","weak"}],"verifyTopics":["..."],"candidateHooks":["..."]}

${HONEST_SCOPING}

Never use an em dash in any output value.`
}

export const orchestrate = ({
  characterName,
  characterRole,
  characterTone,
  scope,
  themes,
}: OrchestratePromptInput) =>
  `You are observing a live practice interview alongside ${characterName} (${characterRole}), taking notes in real time.

Interview context:
${scopeBlock(scope)}

${characterName}'s evaluation lens (guides what you watch hardest):
${characterTone}
${
    themes && themes.length > 0
      ? `\nThe prepared interview themes:\n${themes.map((theme) => `- ${theme}`).join("\n")}\nTrack which themes the conversation has actually covered; a follow_up note may flag a prepared theme not yet touched while time passes.\n`
      : ""
  }
What you listen for: specific stories over generalities ("I" over a hiding "we"), quantified outcomes, honest ownership of failures, reasoning that survives a why-chain, and whether the candidate answers the question that was actually asked. A strong answer is concrete, structured, and owned. A weak one is vague, borrowed, or evasive.

Produce ONE short observation (8-18 words) about the most recent candidate turn, or null if the turn contains nothing worth noting. Classify it:
- strong_answer: the candidate gave a concrete, owned, specific answer. Only when their own words demonstrably earn it; when unsure, no note
- weak_assumption: the candidate leaned on a vague or borrowed claim that won't hold up
- objection: the interviewer pushed back on something
- follow_up: a question still hanging, or a prepared theme not yet covered
- event: a notable shift in tone or topic

Also name the topic being discussed right now, in 5 words or fewer (e.g. "conflict story", "trade-off reasoning"). Use null if it is unclear.

Respond with JSON only, exactly this shape:
{"note":{"type":"<one_of_the_five>","text":"<8-18 word observation>"} | null,"topic":"<5 words or fewer>" | null}`

const engagementBlock = (continuity: DebriefPromptInput["continuity"]): string =>
  continuity
    ? `\nThe engagement so far (memory going into this session):
Previous summary: ${continuity.summary || "(none)"}
Commitments already tracked — open: ${continuity.open.join("; ") || "(none)"}; delivered: ${continuity.delivered.join("; ") || "(none)"}
`
    : ""

const rubricBlock = (blueprint: DebriefPromptInput["blueprint"]): string =>
  blueprint && blueprint.rubric.length > 0
    ? `\nThe pre-declared rubric from the interview blueprint — judge against THIS, not a generic bar:
${blueprint.rubric.map((entry) => `- ${entry.theme}: strong = ${entry.strong} / weak = ${entry.weak}`).join("\n")}
`
    : ""

const verifyBlock = (blueprint: DebriefPromptInput["blueprint"]): string =>
  blueprint && blueprint.verifyTopics.length > 0
    ? `\nRegulated territory flagged before the session (candidates for "verifyItems"): ${blueprint.verifyTopics.join("; ")}
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
  blueprint,
}: DebriefPromptInput) =>
  `You are an interview coach synthesizing a live practice interview into a debrief.

The candidate's scope:
${scopeBlock(scope)}
${engagementBlock(continuity)}${rubricBlock(blueprint)}${verifyBlock(blueprint)}
Interviewer who ran the session: ${characterName} (${characterRole})
Interviewer's evaluation lens: ${characterTone}

Live notes observed during the conversation:
${notes}

Conversation transcript:
${transcript}

Produce the debrief. Return JSON ONLY with this exact shape:
{
  "title": "<a 2-4 word name for this session, e.g. \\"Owned the conflict story\\">",
  "verdict": {
    "decision": "move-forward" | "on-the-fence" | "not-yet",
    "summary": "one-sentence rationale"
  },
  "spokenVerdict": "<the verdict as ${characterName} would say it aloud to the candidate, in one breath — 120 to 160 characters of plain direct speech in their voice, no lists, no headings>",
  "whatHappened": "<one paragraph, 60-120 words, addressed to the candidate in the second person (\\"You told…\\") — concrete about what this session covered, which answers landed, and where the interview stalled>",
  "heldUp": [
    {"quote": "<the candidate's exact words from the transcript, copied verbatim>",
     "why": "<one line on why it landed>"}
  ],
  "didntHold": [
    {"text": "<an answer that fell apart under follow-up, or something missing or unproven, short>", "ref": null}
  ],
  "verifyItems": [
    {"text": "<what to confirm and with whom, e.g. \\"Confirm Georgia's licensing requirements on X with the state board\\">"}
  ],
  "continuity": {
    "summary": "<2-4 sentences a coach could read before the next session: where the candidate stands, what improved, what remains weak>",
    "actionItems": [
      {"text": "<a concrete thing to prepare or fix before the next session — starts with a verb, under 15 words>", "priority": "high" | "medium" | "low"}
    ]
  }
}

"heldUp" holds 0 to 3 items; "didntHold" holds 0 to 4. "ref" is always null in this lane.

"verifyItems" holds 0 to 4 items, ONLY for facts in regulated or licensed territory that came up and that neither you nor ${characterName} can vouch for. This is not feedback on weak answers — those belong in "didntHold"; a verify item means the interviewer could not vouch for a fact. When nothing regulated came up, return [].

"continuity" is the practice thread's compounding memory, not a session note. For the summary: UPDATE the previous summary rather than writing a fresh one — carry forward the durable facts and the arc (stories that work, weaknesses that persist, what's been fixed), fold in what this session changed, and drop only what is fully resolved. Each action item will be read back to the candidate as "last time you said you'd …". 0 to 5 items; never repeat or rephrase a commitment already tracked as open or delivered; if nothing new emerged, return an empty list — never invent a commitment.

CALIBRATION. The candidate's trust depends on honest feedback; never inflate:
- Judge only what the transcript shows. Every sentence of "whatHappened" must trace to actual turns; never credit intent, effort, or content that did not occur.
- If the candidate said little or nothing, "whatHappened" is one plain sentence saying exactly that, the decision is "not-yet", and "spokenVerdict" is ${characterName}'s honest reaction to the non-engagement. "spokenVerdict" is always a judgment of the candidate's performance, never a restatement of a question ${characterName} asked.
- Verdicts are earned: "move-forward" only when the transcript demonstrates it. Torn between two tiers? Choose the lower.
- "didntHold" names what actually went wrong in THIS conversation, not a best-practices checklist. Two real findings beat four generic ones.
- Write plainly. Never use em dashes in any output field.

Be concrete and specific: every line should mention something tied to THIS candidate's role and answers, not generic interview advice.

${HONEST_SCOPING}

Grounding rules (absolute):
- "heldUp" may contain ONLY affirmative answers the candidate actually gave that withstood the interviewer's follow-up (specific stories, numbers, owned decisions), each quoted verbatim in "quote". An admission that something is missing, untested, or unknown is NOT an answer that held up — leave it out. If the candidate gave no defensible answers, return "heldUp": [] — an empty list is the correct, honest output.
- Advice and recommendations belong ONLY in "continuity" action items, never in "heldUp".
- Nowhere in the debrief state specifics the transcript does not contain (companies, numbers, technologies, regulations). Where the candidate provided nothing, say so plainly.`
