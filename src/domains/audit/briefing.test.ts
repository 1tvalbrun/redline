import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import type { Claim, Gap } from "../../lib/audit.ts"

const scope = {
  systemName: "CourtTime production",
  description: "SaaS on AWS, one region, five engineers",
  role: "DevOps lead who owns backups",
  controlArea: "Data Recovery (Control 11)",
  concerns: ["Recovery testing"],
}

const gap = (title: string, severity: Gap["severity"] = "blocker"): Gap => ({
  severity,
  kind: "absent",
  title,
  detail: "detail",
})

const claim = (): Claim => ({
  text: "claim",
  citation: { source: "runbook.pdf", location: "page 1" },
})

test("a fresh session carries the in-scope safeguards, role, and concerns", () => {
  const briefing = buildRoomBriefing({ scope, audit: null, continuity: null, transcript: [] })
  assert.match(briefing.personalityPreamble, /11\.2 Perform Automated Backups/)
  assert.match(briefing.personalityPreamble, /ONLY control content you may reference/)
  assert.match(briefing.personalityPreamble, /DevOps lead who owns backups/)
  assert.match(briefing.personalityPreamble, /Recovery testing.*Probe there without announcing it/)
  assert.match(briefing.startScript, /tell me about CourtTime production/)
})

test("a pre-read with citable documents earns the documents clause and carries the gaps", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: {
      claims: [claim()],
      gaps: [gap("No recovery test report"), gap("No restore evidence", "gap")],
    },
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.startScript, /I went through the CourtTime production documents/)
  assert.match(briefing.personalityPreamble, /No recovery test report/)
})

test("nothing citable drops the documents clause", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: { claims: [], gaps: [gap("No recovery process document")] },
    continuity: null,
    transcript: [],
  })
  assert.doesNotMatch(briefing.startScript, /went through/)
  assert.match(briefing.startScript, /tell me about CourtTime production/)
})

test("open commitments drive the opener; delivered ones are received, not re-asked", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    continuity: {
      lastSessionSummary: "Backup schedule proven; test report outstanding.",
      actionItems: [
        {
          id: "r:0",
          text: "Produce the last recovery test report",
          priority: "high",
          status: "open",
          createdAt: 1,
        },
        {
          id: "r:1",
          text: "Share the backup schedule configuration",
          priority: "medium",
          status: "done",
          createdAt: 2,
        },
      ],
      updatedAt: 2,
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /Last time you said you'd produce the last recovery test report/)
  assert.match(briefing.personalityPreamble, /do not introduce yourself/i)
  assert.match(briefing.personalityPreamble, /already delivered: Share the backup schedule configuration/)
  assert.match(briefing.personalityPreamble, /do not ask for them again/)
})

test("a resume never re-introduces and continues mid-session", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    continuity: null,
    transcript: [
      { text: "We back up nightly", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "How often do backups run?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  assert.match(briefing.startScript, /pick up where you left off/)
})
