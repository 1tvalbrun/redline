import { ASSESSOR_PERSONAS } from "./personas.ts"
import { scopeText, type DomainPack } from "../types.ts"
import { AUDIT_AXES } from "./axes.ts"
import { areaByLabel, CONTROL_AREAS } from "./catalog.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, orchestrate, report } from "./prompts.ts"

export const auditPack: DomainPack = {
  id: "audit",
  label: "Face an audit",
  description:
    "Rehearse an audit interview before the real one. A lead assessor reads your scope and documents, interviews you on the safeguards in session scope, and scores your readiness. Practice feedback, never a compliance determination.",
  subjectField: "systemName",
  subtitleFields: ["role", "controlArea"],
  userLabel: "AUDITEE",
  userTitle: "Auditee",
  scopeFields: [
    {
      key: "systemName",
      label: "What's being assessed",
      kind: "text",
      required: true,
      maxLength: 60,
      placeholder: "e.g. CourtTime production environment",
    },
    {
      key: "description",
      label: "The environment in two lines",
      kind: "textarea",
      required: true,
      maxLength: 600,
      placeholder: "What it is, where it runs, and who operates it",
    },
    {
      key: "role",
      label: "Your role in the audit",
      kind: "text",
      required: true,
      maxLength: 80,
      placeholder: "e.g. DevOps lead who owns backups and recovery",
    },
    {
      key: "controlArea",
      label: "Control area for this session",
      kind: "chips",
      required: true,
      options: CONTROL_AREAS.map((area) => ({ value: area.key, label: area.label })),
    },
    {
      key: "concerns",
      label: "Where you feel least ready",
      kind: "multi",
      options: [
        { value: "Documentation", label: "Documentation" },
        { value: "Evidence and records", label: "Evidence and records" },
        { value: "Live demonstrations", label: "Live demonstrations" },
        { value: "Process consistency", label: "Process consistency" },
        { value: "Ownership and roles", label: "Ownership and roles" },
        { value: "Recovery testing", label: "Recovery testing" },
      ],
    },
  ],
  contextFields: [
    { key: "environmentProfile", label: "Environment profile" },
    { key: "controlOwnership", label: "Control ownership" },
    { key: "evidencePosture", label: "Evidence posture" },
    { key: "riskiestArea", label: "Riskiest area" },
    { key: "likelyFindings", label: "Likely findings" },
    { key: "openQuestions", label: "Open questions" },
  ],
  axes: AUDIT_AXES,
  verdicts: {
    options: [
      { value: "ready", label: "Audit-ready", tone: "good" },
      { value: "shaky", label: "Needs work", tone: "mid" },
      { value: "not-ready", label: "Not ready", tone: "bad" },
    ],
    fallback: "shaky",
  },
  targetLine: { value: 90, label: "Audit-ready" },
  // The ERL appears once a control area is chosen — no area, no list; the
  // deliberate absence of the DEFAULT_AREA fallback here is what makes the
  // panel arrive at the moment of choice.
  evidenceRequests: (scope) => {
    const area = areaByLabel(scopeText(scope, "controlArea"))
    if (!area) return []
    return area.safeguards.map((safeguard) => ({
      title: `Safeguard ${safeguard.id} · ${safeguard.title}`,
      items: safeguard.evidence,
    }))
  },
  copy: {
    intake: {
      kicker: "New audit session",
      heading: "Set the scope.",
      lead: "Tell the assessor what's being assessed, your role, and which control area this session covers. She reads everything before the first question.",
      materialsLabel: "Documents",
      materialsButton: "Add your policies, procedures, or runbooks for the pre-read",
      cta: "Start the pre-read",
    },
    readWait: {
      kicker: "Reading your scope",
      heading: () => "Going through what you gave us.",
      lead: "The assessor's pre-read comes from every line you wrote. This takes a few seconds.",
      rows: [
        { label: "Scope", text: "Registering what's being assessed…" },
        { label: "Environment", text: "Reading the shape of the system…" },
        { label: "Your role", text: "Working out what you own…" },
        { label: "Control area", text: "Pulling the safeguards in session scope…" },
        { label: "Concerns", text: "Noting where you feel least ready…" },
      ],
      work: [
        "Parsing your scope",
        "Profiling the environment",
        "Mapping control ownership",
        "Weighing the evidence posture",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented — if we didn't catch it, we ask.",
        "A gap is a finding, not a failure.",
        "The assessor reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    auditWait: {
      kicker: "The pre-read · before the interview",
      heading: (subject) => `Reading ${subject} against the safeguards in scope.`,
      lead: "We check what your documents establish, and note everything an assessor will ask to see.",
      rows: [
        { label: "Claims", text: "Finding what your documents establish…" },
        { label: "Citations", text: "Tracing each one back to a page…" },
        { label: "Evidence", text: "Checking what's actually on record…" },
        { label: "Omissions", text: "Finding what an assessor expects and can't see…" },
        { label: "Severity", text: "Sorting session-stallers from soft spots…" },
        { label: "Axes", text: "Weighing process, evidence, command, cadence…" },
      ],
      work: [
        "Reading your documents",
        "Extracting established claims",
        "Verifying each against a source",
        "Assembling the gap map",
        "Scoring the four axes",
      ],
      ticker: [
        "Every claim has to trace to a source.",
        "If it can't be cited, it becomes a gap.",
        "Gaps are what the assessor asks to see first.",
        "This is the read before a single question.",
      ],
      stepMs: 2000,
    },
    audit: {
      kicker: "The pre-read · before the interview",
      readyHeading: "Here's what your documents establish, and what's missing.",
      readyLead:
        "Read straight from your materials before a single question. Every gap below is something a real assessor will ask to see. The tough ones come up first.",
      zeroClaims: "That's the finding: the assessor will treat everything as undocumented.",
      cta: "Into the interview",
    },
    panel: {
      kicker: "Meet your assessor",
      heading: "Who's across the table?",
      lead: "The assessor reads your scope and documents before the session opens. Expect to be asked for evidence, not assurances.",
    },
    promptHelpers: [
      "Our documented process says…",
      "The last time we ran this was…",
      "Here's the record that shows…",
      "The owner for that is…",
    ],
  },
  personas: ASSESSOR_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, audit, orchestrate, report },
}
