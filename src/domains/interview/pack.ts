import { INTERVIEWER_PERSONAS } from "./personas.ts"
import { scopeText, type DomainPack, type Scope } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import {
  analyzeSystem,
  analyzeUser,
  blueprint,
  debrief,
  extractScope,
  orchestrate,
  refineBlueprint,
} from "./prompts.ts"

// Labels are the stored scope values and appear verbatim in the
// extractScope prompt; keep both in lockstep.
const INTERVIEW_TYPE_OPTIONS = [
  { value: "screening", label: "Screening call" },
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical & scenarios" },
  { value: "full-loop", label: "Full loop (mixed)" },
]

const SENIORITY_OPTIONS = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "leadership", label: "Leadership" },
]

const FOCUS_AREA_OPTIONS = [
  "Motivation & fit",
  "Career story",
  "Behavioral stories",
  "Ownership",
  "Conflict",
  "Technical depth",
  "Scenario judgment",
  "Communication",
].map((label) => ({ value: label, label }))

// Interview formats are few and stable, so the format drives the
// recommended interviewer; an unset format reads as a full loop.
const TYPE_TO_PERSONA: Record<string, { personaId: string; reason: string }> = {
  "Screening call": { personaId: "screener-01", reason: "Built for the screen" },
  Behavioral: { personaId: "hm-01", reason: "Built for behavioral loops" },
  "Technical & scenarios": { personaId: "practitioner-01", reason: "Built for the deep-dive" },
  "Full loop (mixed)": { personaId: "hm-01", reason: "Anchors a full loop" },
}

export const interviewPack: DomainPack = {
  id: "interview",
  label: "Practice an interview",
  shortLabel: "Interview",
  description:
    "Face the interview before the real one. The panel builds a role-specific blueprint from your role and materials, interviews you live from that plan, then debriefs on what held up.",
  subjectField: "roleTitle",
  subtitleFields: ["seniority", "interviewType"],
  userLabel: "CANDIDATE",
  userTitle: "Candidate",
  scopeFields: [
    {
      key: "roleTitle",
      label: "The role",
      kind: "text",
      required: true,
      maxLength: 80,
      placeholder: "e.g. Engineering Manager, frontend teams",
    },
    {
      key: "interviewType",
      label: "Interview type",
      kind: "chips",
      options: INTERVIEW_TYPE_OPTIONS,
    },
    { key: "seniority", label: "Seniority", kind: "chips", options: SENIORITY_OPTIONS },
    {
      key: "industryContext",
      label: "Industry or company context",
      kind: "text",
      maxLength: 120,
      placeholder: "e.g. regional hospital ICU, B2B SaaS startup",
    },
    {
      key: "focusAreas",
      label: "Where do you want the pressure?",
      kind: "multi",
      options: FOCUS_AREA_OPTIONS,
    },
    {
      key: "jobPosting",
      label: "Job posting",
      kind: "textarea",
      maxLength: 4000,
      placeholder: "Paste the job description if you have one",
    },
  ],
  contextFields: [
    { key: "roleSummary", label: "Role summary" },
    { key: "interviewShape", label: "Interview shape" },
    { key: "pressureAreas", label: "Pressure areas" },
    { key: "riskiestGap", label: "Riskiest gap" },
    { key: "openQuestions", label: "Open questions" },
  ],
  verdicts: {
    options: [
      { value: "move-forward", label: "Would move you forward", tone: "good" },
      { value: "on-the-fence", label: "On the fence", tone: "mid" },
      { value: "not-yet", label: "Wouldn't advance you yet", tone: "bad" },
    ],
    fallback: "on-the-fence",
  },
  prep: {
    kind: "blueprint",
    stepLabel: "Blueprint",
    prompt: blueprint,
    refine: refineBlueprint,
    wait: {
      kicker: "The blueprint · before the room",
      heading: (subject) => `Building the interview plan for ${subject}.`,
      lead: "Your interviewer walks in with a vetted, role-specific plan — not improvised questions. This takes a few seconds.",
      rows: [
        { label: "The role", text: "Reading what this role actually demands…" },
        { label: "Level", text: "Calibrating the pressure to your seniority…" },
        { label: "Materials", text: "Mining your resume and the posting for hooks…" },
        { label: "Themes", text: "Choosing what this interview will probe…" },
        { label: "Questions", text: "Writing the questions and follow-up angles…" },
        { label: "Rubric", text: "Pre-declaring what strong and weak look like…" },
      ],
      work: [
        "Reading your scope",
        "Profiling the role",
        "Drafting the themes",
        "Sealing the questions",
        "Writing the rubric",
      ],
      ticker: [
        "You'll see the themes; the questions stay sealed until the room.",
        "Feedback traces to a rubric written before you speak.",
        "Regulated facts get flagged to verify, never asserted.",
        "A thin brief makes a thin plan. Gaps become clarifying questions.",
      ],
      stepMs: 2000,
    },
    copy: {
      kicker: "The blueprint · before the room",
      readyHeading: "Here's what your interviewer prepared.",
      readyLead:
        "These are the themes your interview will probe — the actual questions stay sealed until the room. Cut what you don't want, redirect the focus, and answer anything they asked. One revision, then it locks.",
      cta: "Lock it in",
    },
  },
  sessionMetaField: "interviewType",
  recommendPersona: (scope: Scope) =>
    TYPE_TO_PERSONA[scopeText(scope, "interviewType")] ?? TYPE_TO_PERSONA["Full loop (mixed)"],
  copy: {
    tellIt: {
      heading: "What are you interviewing for?",
      sub: "Talk through the role, the context, and where you want the pressure. It gets shaped into a brief you'll confirm.",
    },
    form: {
      sections: [
        { title: "The role", keys: ["roleTitle", "industryContext", "jobPosting"] },
        {
          title: "The interview",
          meta: "optional · sharpens the blueprint",
          keys: ["interviewType", "seniority", "focusAreas"],
        },
      ],
      materialsTitle: "Materials",
      materialsMeta: "optional · resume or JD · PDF PPTX XLSX DOCX",
    },
    preview: {
      title: "What your interviewer will read",
      rows: [
        { key: "roleTitle", label: "The role", hint: "Not yet named" },
        {
          key: "industryContext",
          label: "Context",
          hint: "Company, industry, or region — it shapes the questions",
        },
        {
          key: "jobPosting",
          label: "Job posting",
          hint: "Paste it and the plan speaks the company's language",
        },
      ],
      chips: { label: "Format and focus", keys: ["interviewType", "seniority", "focusAreas"] },
      footer: "Only what you put here makes it in; gaps become questions, not guesses.",
    },
    readWait: {
      kicker: "Reading your brief",
      heading: () => "Going through what you gave us.",
      lead: "The blueprint is built from every line you wrote. This takes a few seconds.",
      rows: [
        { label: "The role", text: "Registering what you're interviewing for…" },
        { label: "Context", text: "Placing the role in its industry…" },
        { label: "Format", text: "Reading the shape of the interview…" },
        { label: "Seniority", text: "Calibrating the level of pressure…" },
        { label: "Focus", text: "Noting where you asked for the heat…" },
      ],
      work: [
        "Parsing your scope",
        "Profiling the role",
        "Weighing the seniority bar",
        "Naming the riskiest gap",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented. If we didn't catch it, we ask.",
        "A gap is a finding, not a failure.",
        "Your interviewer reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    panel: {
      kicker: "Meet your interviewers",
      heading: "Who's across the table?",
      lead: "Each runs a different kind of interview from the same blueprint. Start with the format you're actually facing.",
    },
    promptHelpers: [
      "The situation was…",
      "What I actually did was…",
      "The way I'd verify that…",
      "Looking back, I'd change…",
    ],
  },
  personas: INTERVIEWER_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, orchestrate, debrief, extractScope },
}
