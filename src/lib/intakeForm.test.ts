import test from "node:test"
import assert from "node:assert/strict"
import { initialFormState, laneFormsReducer, type LaneForms } from "./intakeForm.ts"

const lane = (forms: LaneForms, id = "sales") => forms[id] ?? initialFormState()

test("typing marks a field touched, clears its inferred marker, and clears its missing flag", () => {
  let forms: LaneForms = {
    sales: {
      ...initialFormState({ offering: "SpaceOS" }),
      inferred: new Set(["offering"]),
      missingKeys: ["offering", "prospect"],
    },
  }
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "change", key: "offering", value: "SpaceOS Pro" },
  })
  assert.equal(lane(forms).scope.offering, "SpaceOS Pro")
  assert.ok(lane(forms).touched.has("offering"))
  assert.ok(!lane(forms).inferred.has("offering"))
  assert.deepEqual(lane(forms).missingKeys, ["prospect"])
})

test("one lane's state never leaks into another", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "interview",
    action: { type: "change", key: "role", value: "Senior Frontend Engineer" },
  })
  forms = laneFormsReducer(forms, {
    lane: "audit",
    action: { type: "change", key: "systemName", value: "Acme ISMS" },
  })
  assert.equal(forms.interview.scope.role, "Senior Frontend Engineer")
  assert.equal(forms.audit.scope.systemName, "Acme ISMS")
  assert.equal(forms.interview.scope.systemName, undefined)
})

test("an extraction fills untouched fields, marks them, and settles its reading entry", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "interview",
    action: { type: "readStart", storageId: "st1", fileName: "resume.pdf" },
  })
  assert.deepEqual(lane(forms, "interview").reading, [{ storageId: "st1", fileName: "resume.pdf" }])
  forms = laneFormsReducer(forms, {
    lane: "interview",
    action: {
      type: "autofill",
      storageId: "st1",
      fileName: "resume.pdf",
      extracted: { role: "Senior Frontend Engineer" },
    },
  })
  const form = lane(forms, "interview")
  assert.equal(form.scope.role, "Senior Frontend Engineer")
  assert.ok(form.inferred.has("role"))
  assert.ok(form.committed.has("role"))
  assert.deepEqual(form.reading, [])
  assert.ok(form.notice?.filled)
})

test("readStart is idempotent per upload — a re-mounted effect can't start a second read", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "readStart", storageId: "st1", fileName: "deck.pdf" },
  })
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "readStart", storageId: "st1", fileName: "deck.pdf" },
  })
  assert.equal(lane(forms).reading.length, 1)
  assert.deepEqual(lane(forms).extracted, ["st1"])
})

test("a failed read settles reading with a quiet notice and fills nothing", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "readStart", storageId: "st1", fileName: "deck.pdf" },
  })
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "readFailed", storageId: "st1", fileName: "deck.pdf" },
  })
  const form = lane(forms)
  assert.deepEqual(form.reading, [])
  assert.equal(form.notice?.filled, false)
  assert.deepEqual(form.scope, {})
})

test("seeding a prefill initializes a lane once and never clobbers work", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "founder",
    action: { type: "seed", scope: { ideaName: "CourtTime" } },
  })
  assert.equal(forms.founder.scope.ideaName, "CourtTime")
  assert.ok(forms.founder.committed.has("ideaName"))
  forms = laneFormsReducer(forms, {
    lane: "founder",
    action: { type: "change", key: "ideaName", value: "CourtTime 2" },
  })
  forms = laneFormsReducer(forms, {
    lane: "founder",
    action: { type: "seed", scope: { ideaName: "CourtTime" } },
  })
  assert.equal(forms.founder.scope.ideaName, "CourtTime 2")
})

test("setMissing records the gaps for its lane only", () => {
  let forms: LaneForms = {}
  forms = laneFormsReducer(forms, {
    lane: "sales",
    action: { type: "setMissing", keys: ["offering"] },
  })
  assert.deepEqual(forms.sales.missingKeys, ["offering"])
  assert.equal(forms.interview, undefined)
})
