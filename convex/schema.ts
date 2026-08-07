import { defineSchema, defineTable } from "convex/server"
import { v, type Infer } from "convex/values"
import { claimValidator, gapValidator } from "../src/lib/audit"

// Closed vocabularies the schema enforces so the database — not just the
// code sets that sanitize model output — rejects the value nothing
// downstream can render. Mutations reuse these; one definition.
export const transcriptTypeValidator = v.union(v.literal("user"), v.literal("panelist"))
export const noteTypeValidator = v.union(
  v.literal("follow_up"),
  v.literal("event"),
  v.literal("strong_answer"),
  v.literal("weak_assumption"),
  v.literal("objection")
)
// Verdict decisions are pack vocabulary (pack.verdicts), enforced where the
// value is produced — reports.generate validates model output against the
// simulation's pack. The schema stores the string; it can't know the pack.
export const priorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
)
export type NoteType = Infer<typeof noteTypeValidator>
export type Priority = Infer<typeof priorityValidator>

export default defineSchema({
  // One row per signed-in person, created at onboarding. lanes is an array
  // on purpose: a user is never locked to one practice lane, even while the
  // UI offers only one. _creationTime serves as createdAt.
  users: defineTable({
    clerkId: v.string(),
    displayName: v.optional(v.string()),
    lanes: v.array(v.string()),
    defaultLane: v.string(),
    // Clickwrap record: when they accepted and which version of /terms.
    // Bump TERMS_VERSION (src/lib/legal.ts) to re-prompt everyone.
    termsAcceptedAt: v.number(),
    termsVersion: v.string(),
  }).index("by_clerk", ["clerkId"]),

  // One durable idea accrues a readiness trajectory across many runs.
  // _creationTime serves as createdAt.
  //
  // userId is the owner's Clerk subject, stamped once at insert and never
  // changed — same on simulations/rooms/reports. by_user_name also serves
  // the plain by-user listings via prefix equality.
  ideas: defineTable({
    name: v.string(),
    userId: v.string(),
  }).index("by_user_name", ["userId", "name"]),

  // Which Runway Character plays each pack persona. Rows are written only by
  // the internal register mutation (npx convex run avatars:register); the
  // connect route allowlists against by_runway, and rooms.create resolves
  // the avatar id for a persona here. Replaces the NEXT_PUBLIC_RUNWAY_AVATAR_*
  // env vars, so adding an avatar needs no rebuild.
  avatars: defineTable({
    packId: v.string(),
    personaId: v.string(),
    runwayAvatarId: v.string(),
  })
    .index("by_pack_persona", ["packId", "personaId"])
    .index("by_runway", ["runwayAvatarId"]),

  simulations: defineTable({
    ideaId: v.optional(v.id("ideas")),
    userId: v.string(),
    title: v.string(),
    // Legacy rows only. Superseded by packId; simulations.create stopped
    // writing it.
    roomType: v.optional(v.string()),
    // Domain pack id (src/domains/registry.ts). Absent on legacy rows, which
    // read as the founder pack.
    packId: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("analyzing"), v.literal("ready")),
    // Legacy rows only (founder-shaped). Superseded by scope; simulations
    // .create stopped writing it. Read through scopeOf, never directly.
    brief: v.optional(
      v.object({
        ideaName: v.string(),
        stage: v.string(),
        description: v.string(),
        targetUser: v.string(),
        businessModel: v.string(),
        whyNow: v.optional(v.string()),
        focusAreas: v.array(v.string()),
      })
    ),
    // What the user is bringing into the session, keyed by the pack's
    // scopeFields. Keys and sizes are validated in simulations.create
    // against the pack — the schema can't know which pack a row belongs to.
    scope: v.optional(v.record(v.string(), v.union(v.string(), v.array(v.string())))),
    // The Read stage's extraction, keyed by the pack's contextFields.
    // Legacy founder rows (fixed 7-key object) conform to the record shape.
    context: v.optional(v.record(v.string(), v.string())),
    version: v.number(),
  })
    .index("by_idea", ["ideaId"])
    .index("by_user", ["userId"]),

  rooms: defineTable({
    simulationId: v.id("simulations"),
    userId: v.string(),
    characters: v.array(
      v.object({
        id: v.string(),
        archetypeId: v.string(),
        name: v.string(),
        role: v.string(),
        avatarId: v.string(),
        tone: v.string(),
        // Legacy rows only. Never read; the live persona is stored on the
        // Runway Character and rooms.create stopped writing this.
        systemPrompt: v.optional(v.string()),
        status: v.string(),
      })
    ),
    activeCharacterId: v.optional(v.string()),
    transcript: v.array(
      v.object({
        speaker: v.string(),
        speakerName: v.string(),
        text: v.string(),
        timestamp: v.number(),
        // Measured speech onset (wall-clock ms). Entries arrive out of
        // speech order — finals land long after speaking begins — so
        // consumers sort on this, falling back to timestamp (write time)
        // for rows that predate the field.
        spokenAt: v.optional(v.number()),
        type: transcriptTypeValidator,
      })
    ),
    // Live per-axis risk, keyed by the pack's axes (legacy founder rows
    // conform: same shape, founder keys). Axis keys are validated against
    // the pack inside updateRiskScores.
    riskScores: v.record(v.string(), v.number()),
    liveNotes: v.array(
      v.object({
        type: noteTypeValidator,
        text: v.string(),
        timestamp: v.number(),
      })
    ),
    // Legacy rows only. A round state machine never materialized; rooms.create
    // stopped writing this.
    round: v.optional(v.string()),
    status: v.union(v.literal("live"), v.literal("concluded")),
    verdict: v.optional(
      v.object({
        // Pack verdict vocabulary; validated in reports.generate.
        decision: v.string(),
        summary: v.string(),
        confidence: v.number(),
      })
    ),
  })
    .index("by_simulation", ["simulationId"])
    .index("by_user", ["userId"]),

  // Extracted text from intake materials, keyed to a simulation. Text is
  // consumed by the audit pipeline server-side and never listed back to the
  // client wholesale (this is not a data room).
  materials: defineTable({
    simulationId: v.id("simulations"),
    storageId: v.id("_storage"),
    name: v.string(),
    fileType: v.union(
      v.literal("pdf"),
      v.literal("pptx"),
      v.literal("xlsx"),
      v.literal("docx")
    ),
    size: v.number(),
    status: v.union(v.literal("extracting"), v.literal("ready"), v.literal("failed")),
    failureReason: v.optional(v.string()),
    text: v.optional(v.string()),
  }).index("by_simulation", ["simulationId"]),

  // Pre-run audit derived from the user's materials. Every stored claim
  // carries a citation that grounding has verified against the extracted
  // text; ungrounded assertions only exist here as "unsupported" gaps.
  audits: defineTable({
    simulationId: v.id("simulations"),
    status: v.union(v.literal("running"), v.literal("ready"), v.literal("failed")),
    claims: v.array(claimValidator),
    gaps: v.array(gapValidator),
    failureReason: v.optional(v.string()),
  }).index("by_simulation", ["simulationId"]),

  reports: defineTable({
    simulationId: v.id("simulations"),
    roomId: v.id("rooms"),
    userId: v.string(),
    overallScore: v.number(),
    // Pack verdict vocabulary; validated in reports.generate.
    verdict: v.string(),
    executiveSummary: v.string(),
    panelVerdicts: v.array(
      v.object({
        characterId: v.string(),
        characterName: v.string(),
        verdict: v.string(),
        score: v.number(),
        reasoning: v.string(),
      })
    ),
    topRisks: v.array(v.string()),
    // "Held up" findings. Populated only through groundHeldUp — every entry
    // traces to a verbatim user quote; empty means nothing survived.
    opportunities: v.array(v.string()),
    nextSevenDays: v.array(
      v.object({
        day: v.number(),
        task: v.string(),
        priority: priorityValidator,
      })
    ),
    // The one-line verdict the delivering panelist "speaks": rendered as the
    // quote over the composed panel still, their seat lit.
    spokenVerdict: v.object({
      speakerId: v.string(),
      speakerName: v.string(),
      text: v.string(),
    }),
  })
    .index("by_simulation", ["simulationId"])
    .index("by_user", ["userId"]),
})
