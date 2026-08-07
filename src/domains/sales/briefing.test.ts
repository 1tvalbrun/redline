import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import type { Claim, Gap } from "../../lib/audit.ts"

const scope = {
  offering: "CourtFlow",
  description: "Scheduling for shared gym space",
  prospect: "Facilities manager at a mid-size gym",
  ask: "A pilot",
  objections: ["Switching cost"],
}

const gap = (title: string, axis: Gap["axis"], severity: Gap["severity"] = "blocker"): Gap => ({
  severity,
  kind: "absent",
  title,
  detail: "detail",
  axis,
})

const claim = (axis: Claim["axis"]): Claim => ({
  text: "claim",
  citation: { source: "one-pager.pdf", location: "page 1" },
  axis,
})

test("a fresh session casts the avatar as the prospect and carries the ask", () => {
  const briefing = buildRoomBriefing({ scope, audit: null, transcript: [] })
  assert.match(briefing.personalityPreamble, /Facilities manager at a mid-size gym/)
  assert.match(briefing.personalityPreamble, /say yes to: A pilot/)
  assert.match(briefing.personalityPreamble, /Switching cost/)
  assert.match(briefing.startScript, /you've got my attention/i)
})

test("a fresh session with an audit opens on the weakest axis", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: {
      claims: [claim("value")],
      gaps: [gap("No pricing anywhere", "close"), gap("No references", "objections", "gap")],
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /what exactly you're asking me to commit to/)
  assert.match(briefing.personalityPreamble, /No pricing anywhere/)
  assert.match(briefing.personalityPreamble, /CourtFlow/)
})

test("a resume never re-introduces and digests turns in speech order", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    transcript: [
      { text: "Answer about rollout", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "How long does rollout take?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  const questionAt = briefing.personalityPreamble.indexOf("How long does rollout take?")
  const answerAt = briefing.personalityPreamble.indexOf("Answer about rollout")
  assert.ok(questionAt !== -1 && answerAt !== -1 && questionAt < answerAt)
  assert.match(briefing.startScript, /pick it up wherever you left it/)
})

test("a session with no expected objections stays silent about them", () => {
  const briefing = buildRoomBriefing({
    scope: { ...scope, objections: [] },
    audit: null,
    transcript: [],
  })
  assert.doesNotMatch(briefing.personalityPreamble, /raise them naturally/)
})

test("an audit with nothing citable opens on the weakest axis without claiming to have read material", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: { claims: [], gaps: [gap("No customer references", "objections")] },
    transcript: [],
  })
  assert.match(briefing.startScript, /concerns you're going to hear/)
  assert.doesNotMatch(briefing.startScript, /read through/)
})
