import {
  BUSINESS_MODEL_OPTIONS,
  FOCUS_OPTIONS,
  STAGE_OPTIONS,
  TARGET_OPTIONS,
} from "../../lib/briefOptions.ts"
import { PANEL_PERSONAS } from "./personas.ts"
import type { DomainPack } from "../types.ts"
import { FOUNDER_AXES } from "./axes.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, extractBrief, orchestrate, report } from "./prompts.ts"

export const founderPack: DomainPack = {
  id: "founder",
  label: "Pitch a startup",
  description:
    "Face an investor panel before the real one. Your idea gets read, audited, and interrogated live, then scored.",
  subjectField: "ideaName",
  subtitleFields: ["stage", "businessModel"],
  userLabel: "FOUNDER",
  userTitle: "Founder",
  scopeFields: [
    {
      key: "ideaName",
      label: "Idea name",
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
  axes: FOUNDER_AXES,
  verdicts: {
    options: [
      { value: "advance", label: "Advance", tone: "good" },
      { value: "iterate", label: "Iterate", tone: "mid" },
      { value: "pass", label: "Pass", tone: "bad" },
    ],
    fallback: "iterate",
  },
  targetLine: { value: 90, label: "Investor-ready" },
  copy: {
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
        "Nothing gets invented — if we didn’t catch it, we ask.",
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
        { label: "Axes", text: "Weighing market, customer, technical, go-to-market…" },
      ],
      work: [
        "Reading your materials",
        "Extracting stated claims",
        "Verifying each against a source",
        "Assembling the gap map",
        "Scoring the four axes",
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
      kicker: "Choose your interrogator",
      heading: "Who do you want to face first?",
      lead: "Each panelist reads your brief before the room opens. Start with whoever you least want to talk to. That's usually the one worth the most.",
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
  prompts: { analyzeSystem, analyzeUser, extractBrief, audit, orchestrate, report },
}
