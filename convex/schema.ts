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
export const priorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
)
export const actionItemStatusValidator = v.union(
  v.literal("open"),
  v.literal("done"),
  v.literal("dropped")
)
export type NoteType = Infer<typeof noteTypeValidator>
export type Priority = Infer<typeof priorityValidator>
export type ActionItemStatus = Infer<typeof actionItemStatusValidator>

// Cross-session memory, written at debrief time and read into the next
// session's briefing. Bounded (one summary, ≤10 open items), so it lives
// inline on the practice — the durable thread that links sessions.
export const continuityValidator = v.object({
  lastSessionSummary: v.string(),
  actionItems: v.array(
    v.object({
      id: v.string(),
      text: v.string(),
      priority: priorityValidator,
      status: actionItemStatusValidator,
      fromSessionId: v.id("sessions"),
      createdAt: v.number(),
    })
  ),
  updatedAt: v.number(),
})

// The session's written outcome. Verdict decisions are pack vocabulary
// (pack.verdicts), validated where the value is produced —
// sessions.generateDebrief — because the schema can't know the pack.
export const debriefValidator = v.object({
  title: v.string(),
  verdict: v.string(),
  verdictSummary: v.string(),
  spokenVerdict: v.object({
    speakerId: v.string(),
    speakerName: v.string(),
    text: v.string(),
  }),
  whatHappened: v.string(),
  heldUp: v.array(v.object({ quote: v.string(), why: v.string() })),
  didntHold: v.array(v.object({ text: v.string(), ref: v.optional(v.string()) })),
})

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

  // Which Runway Character plays each pack persona. Rows are written only by
  // the internal register mutation (npx convex run avatars:register); the
  // connect route allowlists against by_runway, and session creation
  // resolves the avatar id for a persona here.
  avatars: defineTable({
    packId: v.string(),
    personaId: v.string(),
    runwayAvatarId: v.string(),
  })
    .index("by_pack_persona", ["packId", "personaId"])
    .index("by_runway", ["runwayAvatarId"]),

  // The durable coaching thread: one brief, one persona, many sessions.
  // userId is the owner's Clerk subject, stamped once at insert and never
  // changed — same on sessions/materials.
  practices: defineTable({
    userId: v.string(),
    name: v.string(),
    packId: v.string(),
    // Chosen at the meet step; sessions snapshot the full persona.
    personaId: v.optional(v.string()),
    // Pinned practices sort to the top of their lane.
    pinned: v.optional(v.boolean()),
    status: v.union(v.literal("draft"), v.literal("shaping"), v.literal("ready")),
    // What the user brought in, keyed by the pack's scopeFields. Keys and
    // sizes are validated in practices.create against the pack.
    scope: v.record(v.string(), v.union(v.string(), v.array(v.string()))),
    // The shaping extraction, keyed by the pack's contextFields.
    context: v.optional(v.record(v.string(), v.string())),
    // Pre-session evidence audit ("still unproven"). Claims carry citations
    // grounding verified against extracted material text.
    audit: v.optional(
      v.object({
        status: v.union(v.literal("running"), v.literal("ready"), v.literal("failed")),
        claims: v.array(claimValidator),
        gaps: v.array(gapValidator),
        failureReason: v.optional(v.string()),
      })
    ),
    continuity: v.optional(continuityValidator),
  }).index("by_user", ["userId"]),

  // One live conversation with the practice's persona, debrief embedded —
  // a session without a debrief either is live or ended without a verdict.
  sessions: defineTable({
    practiceId: v.id("practices"),
    userId: v.string(),
    persona: v.object({
      id: v.string(),
      archetypeId: v.string(),
      name: v.string(),
      role: v.string(),
      tone: v.string(),
      avatarId: v.string(),
    }),
    transcript: v.array(
      v.object({
        speaker: v.string(),
        speakerName: v.string(),
        text: v.string(),
        timestamp: v.number(),
        // Measured speech onset (wall-clock ms). Entries arrive out of
        // speech order — finals land long after speaking begins — so
        // consumers sort on this, falling back to timestamp (write time).
        spokenAt: v.optional(v.number()),
        type: transcriptTypeValidator,
      })
    ),
    liveNotes: v.array(
      v.object({
        type: noteTypeValidator,
        text: v.string(),
        timestamp: v.number(),
      })
    ),
    // What's being discussed right now (orchestrator-written, ≤5 words) —
    // feeds the room's topic chip.
    currentTopic: v.optional(v.string()),
    status: v.union(v.literal("live"), v.literal("concluded")),
    endedAt: v.optional(v.number()),
    debrief: v.optional(debriefValidator),
  })
    .index("by_practice", ["practiceId"])
    .index("by_practice_status", ["practiceId", "status"])
    .index("by_user", ["userId"]),

  // Extracted text from intake materials, keyed to a practice. Text is
  // consumed by the audit pipeline server-side and never listed back to the
  // client wholesale (this is not a data room).
  materials: defineTable({
    practiceId: v.id("practices"),
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
  }).index("by_practice", ["practiceId"]),
})
