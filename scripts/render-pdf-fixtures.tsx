// Renders both export documents from fixture data so layout changes can be
// checked by eye before they ship: pnpm render:pdf, then open the files it
// prints. This is the only net under src/lib/pdf — tsc passes on structurally
// broken JSX (a misplaced </View> once shipped every section inside a
// flex-row), and no component test can see a collapsed page.
import path from "node:path"
import { mkdirSync } from "node:fs"
import { renderToFile } from "@react-pdf/renderer"
import { practiceReport } from "../src/lib/pdf/PracticeReport"
import { sessionDebrief } from "../src/lib/pdf/SessionDebrief"

const OUT_DIR = path.join(process.cwd(), ".pdf-fixtures")

const EXPORTED_AT = Date.UTC(2026, 7, 27)
const SESSION_AT = Date.UTC(2026, 7, 26)

const report = practiceReport({
  practiceName: "Compliance audit",
  laneLabel: "Audit lane",
  personaName: "Marcus Webb",
  exportedAt: EXPORTED_AT,
  claims: [
    {
      text: "Business continuity plan names a recovery time objective of 4 hours for tier-1 systems.",
      citation: { source: "BC_Plan.pptx", location: "slide 9" },
    },
    {
      text: "Control inventory tracks 114 K-ISMS controls with owner and review cadence per row.",
      citation: { source: "K-ISMS_Controls.xlsx", location: "sheet control matrix" },
    },
  ],
  gaps: [
    {
      severity: "blocker",
      kind: "absent",
      title: "No recovery test report",
      detail:
        "The BC plan mandates an annual restore drill; no report or timing evidence appears in the materials.",
    },
    {
      severity: "gap",
      kind: "unsupported",
      title:
        "User Account Management Policy provides guidelines for user account management including provisioning, deprovisioning, and periodic access reviews",
      detail: "Stated, but nothing in the materials backs it.",
    },
  ],
  openQuestions: [
    "When was the last periodic access review completed, and what did it find?",
    "Which tier-1 system has actually been restored end-to-end, and how long did it take?",
  ],
  actionItems: [
    { text: "Pull the spring recovery test report and attach the restore timings", priority: "high", status: "done" },
    { text: "Export the MFA enforcement configuration for the admin group", priority: "medium", status: "open" },
  ],
  sessions: [
    { startedAt: SESSION_AT, verdictLabel: "Iterate", title: "Evidence on request" },
    { startedAt: Date.UTC(2026, 7, 22), verdictLabel: null, title: null },
  ],
})

const debrief = sessionDebrief({
  practiceName: "Compliance audit",
  personaName: "Marcus Webb",
  sessionDate: SESSION_AT,
  exportedAt: EXPORTED_AT,
  title: "Evidence on request",
  verdictLabel: "Iterate",
  verdictSummary: "Operational capability shown; the record didn't follow.",
  spokenVerdict: "Bring me the record, not the reassurance.",
  whatHappened:
    "You confirmed the spring recovery drill restored in 42 minutes and held your ground on the RPO figure, but every time the conversation turned to records — the test report, the vault policy, the MFA rollout evidence — you offered reassurance instead of a document.",
  heldUp: [
    {
      quote: "The spring drill restored in 42 minutes",
      why: "Specific and measured — a number an auditor can test.",
    },
  ],
  didntHold: [
    { text: "No recovery test report produced when asked directly.", ref: "11.5" },
    { text: "The vault policy was “with you” but never surfaced." },
  ],
  verifyItems: [
    {
      text: "Confirm whether K-ISMS certification requires the restore drill report at initial audit or first surveillance.",
    },
  ],
  actionItems: [
    { text: "Pull the spring recovery test report and attach the restore timings", priority: "high", status: "open" },
  ],
})

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true })
  const reportPath = path.join(OUT_DIR, "practice-report.pdf")
  const debriefPath = path.join(OUT_DIR, "session-debrief.pdf")
  await renderToFile(report, reportPath)
  await renderToFile(debrief, debriefPath)
  console.log(reportPath)
  console.log(debriefPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
