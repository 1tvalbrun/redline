import { FOCUS_OPTIONS, STAGE_OPTIONS } from "../../lib/briefOptions.ts"
import { PANEL_PERSONAS } from "./personas.ts"
import type { DomainPack, ScopeFieldOption } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"

// Chip vocabularies for the typed form. Labels are the stored scope values
// and appear verbatim in the extractScope prompt; keep both in lockstep.
const BUSINESS_MODEL_OPTIONS: ScopeFieldOption[] = [
  { value: "saas-seat", label: "SaaS · per-seat" },
  { value: "saas-usage", label: "SaaS · usage-based" },
  { value: "saas-tiered", label: "SaaS · tiered" },
  { value: "marketplace", label: "Marketplace" },
  { value: "ads", label: "Ad-supported" },
  { value: "transactional", label: "One-time" },
  { value: "freemium", label: "Freemium" },
  { value: "enterprise-license", label: "Enterprise" },
]

const TARGET_OPTIONS: ScopeFieldOption[] = [
  { value: "smb-founders", label: "SMB founders" },
  { value: "midmarket-leaders", label: "Mid-market product leaders" },
  { value: "enterprise-buyers", label: "Enterprise buyers" },
  { value: "vc-backed-saas", label: "B2B SaaS (Series B+)" },
  { value: "developers", label: "Developers" },
  { value: "designers-creators", label: "Designers and creators" },
  { value: "consumers", label: "Consumer audiences" },
]

export const founderPack: DomainPack = {
  id: "founder",
  label: "Pitch a startup",
  shortLabel: "Founder",
  description:
    "Face an investor panel before the real one. Your idea gets read, audited, and interrogated live, then debriefed.",
  subjectField: "ideaName",
  subtitleFields: ["stage", "businessModel"],
  userLabel: "FOUNDER",
  userTitle: "Founder",
  scopeFields: [
    {
      key: "ideaName",
      label: "Name",
      kind: "text",
      required: true,
      maxLength: 60,
      placeholder: "e.g. Cartograph",
    },
    {
      key: "description",
      label: "What it is",
      kind: "textarea",
      required: true,
      maxLength: 600,
      placeholder: "What it does, who it's for, in a couple of lines",
    },
    {
      key: "whyNow",
      label: "Why now",
      kind: "textarea",
      maxLength: 400,
      placeholder: "What changed that makes now the moment",
    },
    { key: "stage", label: "Stage", kind: "chips", options: STAGE_OPTIONS },
    {
      key: "businessModel",
      label: "Business model",
      kind: "chips",
      options: BUSINESS_MODEL_OPTIONS,
    },
    { key: "targetUser", label: "Target user", kind: "chips", options: TARGET_OPTIONS },
    {
      key: "focusAreas",
      label: "The one thing we should challenge most",
      kind: "multi",
      options: FOCUS_OPTIONS.map((area) => ({ value: area, label: area })),
    },
  ],
  contextFields: [
    { key: "problem", label: "Problem" },
    { key: "targetCustomer", label: "Target customer" },
    { key: "coreAssumption", label: "Core assumption" },
    { key: "revenueModel", label: "Revenue model" },
    { key: "primaryRisk", label: "Primary risk" },
    { key: "competitors", label: "Competitors" },
    { key: "openQuestions", label: "Open questions" },
  ],
  verdicts: {
    options: [
      { value: "advance", label: "Advance", tone: "good" },
      { value: "iterate", label: "Iterate", tone: "mid" },
      { value: "pass", label: "Pass", tone: "bad" },
    ],
    fallback: "iterate",
  },
  copy: {
    tellIt: {
      heading: "What are you building?",
      sub: "Pitch it like the panel is already across the table: the problem, the customer, the ask. It gets shaped into a brief you'll confirm.",
    },
    form: {
      sections: [
        { title: "The idea", keys: ["ideaName", "description", "whyNow"] },
        {
          title: "Context",
          meta: "optional · helps your panel calibrate",
          keys: ["stage", "businessModel", "targetUser", "focusAreas"],
        },
      ],
      materialsTitle: "Materials",
      materialsMeta: "optional · PDF PPTX XLSX DOCX",
    },
    preview: {
      title: "What your panel will read",
      rows: [
        { key: "ideaName", label: "The idea", hint: "Not yet named" },
        {
          key: "description",
          label: "What it is",
          hint: "Say it plainly, this is their first impression",
        },
        { key: "whyNow", label: "Why now", hint: "The gap here becomes their first question" },
      ],
      chips: { label: "Context", keys: ["stage", "businessModel", "targetUser", "focusAreas"] },
      footer: "Only what you put here makes it in; gaps become questions, not guesses.",
    },
    readWait: {
      kicker: "Reading your brief",
      heading: () => "Going through what you gave us.",
      lead: "The panel's analyst reads every line before a single question. This takes a few seconds.",
      rows: [
        { label: "Idea name", text: "Registering what you’re building…" },
        { label: "What it is", text: "Reading the shape of the product…" },
        { label: "Who it’s for", text: "Working out who actually buys this…" },
        { label: "Why now", text: "Looking for what changed to make this urgent…" },
        { label: "Stage", text: "Placing you on the maturity curve…" },
        { label: "Business model", text: "Tracing how the money is meant to work…" },
      ],
      work: [
        "Parsing your brief",
        "Mapping the problem space",
        "Surfacing core assumptions",
        "Naming the primary risk",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented. If we didn’t catch it, we ask.",
        "A gap is a finding, not a failure.",
        "The panel reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    auditWait: {
      kicker: "The audit · before the panel pushes",
      heading: (subject) => `Reading ${subject} against a diligence framework.`,
      lead: "We check every claim for backing, and note everything a real diligencer would ask for.",
      rows: [
        { label: "Claims", text: "Pulling out every claim you’ve made…" },
        { label: "Citations", text: "Tracing each one back to a page…" },
        { label: "Evidence", text: "Checking what’s actually backed…" },
        { label: "Omissions", text: "Finding what a diligencer expects and can’t see…" },
        { label: "Severity", text: "Sorting blockers from gaps…" },
        { label: "Coverage", text: "Weighing market, customer, technical, go-to-market…" },
      ],
      work: [
        "Reading your materials",
        "Extracting stated claims",
        "Verifying each against a source",
        "Assembling the gap map",
        "Mapping the pressure points",
      ],
      ticker: [
        "Every claim has to trace to a source.",
        "If it can’t be cited, it becomes a gap.",
        "Gaps are what the panel presses on first.",
        "This is the read before a single question.",
      ],
      stepMs: 2000,
    },
    audit: {
      kicker: "The audit · before the panel pushes",
      readyHeading: "Here's what we found, and what's missing.",
      readyLead:
        "Read straight from your materials before a single question. Every gap below is something a real diligencer will find. The panel presses on the red ones first.",
      zeroClaims: "That's the finding: the panel will treat everything as unproven.",
      cta: "Take it to the panel",
    },
    panel: {
      kicker: "Choose who to practice with",
      heading: "Who do you want to face first?",
      lead: "Start with whoever you least want to talk to. That's usually the one worth the most.",
    },
    promptHelpers: [
      "Our wedge is…",
      "The reason this is urgent…",
      "What would change your mind…",
      "The honest counter-argument…",
    ],
  },
  personas: PANEL_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, audit, orchestrate, debrief, extractScope },
}
