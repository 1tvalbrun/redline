import { BUYER_PERSONAS } from "./personas.ts"
import type { DomainPack } from "../types.ts"
import { OBJECTIONS } from "./objections.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"

export const salesPack: DomainPack = {
  id: "sales",
  label: "Pitch a sale",
  shortLabel: "Sales",
  description:
    "Face the buyer before the real one. Your offer gets read, audited, and pushed on live by a skeptical operator, then debriefed on whether the deal moved.",
  subjectField: "offering",
  subtitleFields: ["prospect", "ask"],
  userLabel: "SELLER",
  userTitle: "Seller",
  scopeFields: [
    {
      key: "offering",
      label: "What you're selling",
      kind: "text",
      required: true,
      maxLength: 60,
      placeholder: "e.g. CourtFlow scheduling",
    },
    {
      key: "description",
      label: "What it does",
      kind: "textarea",
      required: true,
      maxLength: 600,
      placeholder: "What it does and the problem it removes, in a couple of lines",
    },
    {
      key: "prospect",
      label: "Who you're pitching",
      kind: "text",
      required: true,
      maxLength: 80,
      placeholder: "e.g. Facilities manager at a mid-size gym",
    },
    {
      key: "ask",
      label: "What you're asking them to say yes to",
      kind: "chips",
      options: [
        { value: "discovery", label: "A discovery call" },
        { value: "pilot", label: "A pilot" },
        { value: "paid-pilot", label: "A paid pilot" },
        { value: "partnership", label: "A partnership" },
        { value: "contract", label: "A signed contract" },
      ],
    },
    {
      key: "objections",
      label: "Objections you expect",
      kind: "multi",
      options: OBJECTIONS.map((objection) => ({
        value: objection.label,
        label: objection.label,
      })),
    },
  ],
  contextFields: [
    { key: "coreOffer", label: "Core offer" },
    { key: "buyerProfile", label: "Buyer profile" },
    { key: "valueProposition", label: "Value proposition" },
    { key: "pricingShape", label: "Pricing shape" },
    { key: "riskiestAssumption", label: "Riskiest assumption" },
    { key: "likelyObjections", label: "Likely objections" },
    { key: "openQuestions", label: "Open questions" },
  ],
  verdicts: {
    options: [
      { value: "buy", label: "Would buy", tone: "good" },
      { value: "second-meeting", label: "Second meeting", tone: "mid" },
      { value: "walk", label: "Would walk", tone: "bad" },
    ],
    fallback: "second-meeting",
  },
  copy: {
    tellIt: {
      heading: "What are you selling?",
      sub: "Talk through what you're selling, who's across the table, and what you're asking them to say yes to. It gets shaped into a brief you'll confirm.",
    },
    form: {
      sections: [
        { title: "The deal", keys: ["offering", "description", "prospect"] },
        { title: "The ask", keys: ["ask", "objections"] },
      ],
      materialsTitle: "Materials",
      materialsMeta: "optional · PDF PPTX XLSX DOCX",
    },
    preview: {
      title: "What Cole will read",
      rows: [
        { key: "offering", label: "Selling", hint: "Not yet named" },
        {
          key: "description",
          label: "What it does",
          hint: "The problem it removes, in Cole's terms",
        },
        { key: "prospect", label: "Across the table", hint: "Who Cole is playing" },
      ],
      chips: { label: "Ask and objections", keys: ["ask", "objections"] },
      footer: "Only what you put here makes it in; gaps become questions, not guesses.",
    },
    readWait: {
      kicker: "Reading your pitch",
      heading: () => "Going through what you gave us.",
      lead: "The buyer's brief is built from every line you wrote. This takes a few seconds.",
      rows: [
        { label: "Offering", text: "Registering what you're selling…" },
        { label: "What it does", text: "Reading the shape of the offer…" },
        { label: "The prospect", text: "Working out who's across the table…" },
        { label: "The ask", text: "Pinning down what a yes looks like…" },
        { label: "Objections", text: "Lining up the pushback you expect…" },
      ],
      work: [
        "Parsing your scope",
        "Profiling the buyer",
        "Weighing the value story",
        "Naming the riskiest assumption",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented. If we didn't catch it, we ask.",
        "A gap is a finding, not a failure.",
        "The buyer reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    auditWait: {
      kicker: "The audit · before the buyer pushes",
      heading: (subject) => `Reading ${subject} the way a buyer would.`,
      lead: "We check every claim for backing, and note everything a skeptical buyer will ask for.",
      rows: [
        { label: "Claims", text: "Pulling out every claim you've made…" },
        { label: "Citations", text: "Tracing each one back to a page…" },
        { label: "Evidence", text: "Checking what's actually backed…" },
        { label: "Omissions", text: "Finding what a buyer expects and can't see…" },
        { label: "Severity", text: "Sorting deal-stallers from soft spots…" },
        { label: "Coverage", text: "Weighing value, fit, objections, the close…" },
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
        "If it can't be cited, it becomes a gap.",
        "Gaps are what the buyer presses on first.",
        "This is the read before a single question.",
      ],
      stepMs: 2000,
    },
    audit: {
      kicker: "The audit · before the buyer pushes",
      readyHeading: "Here's what we found, and what's missing.",
      readyLead:
        "Read straight from your materials before a single question. Every gap below is something a real buyer will find. The tough ones come up first.",
      zeroClaims: "That's the finding: the buyer will treat everything as unproven.",
      cta: "Take it to the buyer",
    },
    panel: {
      kicker: "Meet your buyer",
      heading: "Who's across the table?",
      lead: "The buyer reads your scope and materials before the room opens. Expect the objections you named, and a few you didn't.",
    },
    promptHelpers: [
      "The problem this removes is…",
      "Compared to what you do today…",
      "Here's what month three looks like…",
      "What I'd like to walk away with…",
    ],
  },
  personas: BUYER_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, audit, orchestrate, debrief, extractScope },
}
