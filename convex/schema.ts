import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { claimValidator, gapValidator } from "../src/lib/audit"

export default defineSchema({
  // One durable idea accrues a readiness trajectory across many runs.
  // _creationTime serves as createdAt.
  ideas: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  simulations: defineTable({
    ideaId: v.optional(v.id("ideas")),
    title: v.string(),
    roomType: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("live"),
      v.literal("complete")
    ),
    brief: v.object({
      ideaName: v.string(),
      stage: v.string(),
      description: v.string(),
      targetUser: v.string(),
      businessModel: v.string(),
      whyNow: v.optional(v.string()),
      focusAreas: v.array(v.string()),
    }),
    context: v.optional(
      v.object({
        problem: v.string(),
        targetCustomer: v.string(),
        coreAssumption: v.string(),
        revenueModel: v.string(),
        primaryRisk: v.string(),
        competitors: v.string(),
        openQuestions: v.string(),
      })
    ),
    version: v.number(),
  }).index("by_idea", ["ideaId"]),

  rooms: defineTable({
    simulationId: v.id("simulations"),
    characters: v.array(
      v.object({
        id: v.string(),
        archetypeId: v.string(),
        name: v.string(),
        role: v.string(),
        avatarId: v.string(),
        tone: v.string(),
        systemPrompt: v.string(),
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
        type: v.string(),
      })
    ),
    riskScores: v.object({
      market: v.optional(v.number()),
      customer: v.optional(v.number()),
      technical: v.optional(v.number()),
      gtm: v.optional(v.number()),
    }),
    liveNotes: v.array(
      v.object({
        type: v.string(),
        text: v.string(),
        timestamp: v.number(),
      })
    ),
    round: v.string(),
    status: v.string(),
    verdict: v.optional(
      v.object({
        decision: v.string(),
        summary: v.string(),
        confidence: v.number(),
      })
    ),
  }).index("by_simulation", ["simulationId"]),

  // Extracted text from founder materials, keyed to a simulation. Text is
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

  // Pre-run audit derived from the founder's materials. Every stored claim
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
    overallScore: v.number(),
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
    // traces to a verbatim founder quote; empty means nothing survived.
    opportunities: v.array(v.string()),
    nextSevenDays: v.array(
      v.object({
        day: v.number(),
        task: v.string(),
        priority: v.string(),
      })
    ),
    // Legacy scene-image pipeline (removed — the verdict video replaced
    // it). Kept optional so reports generated before the removal still
    // validate; new reports write neither field.
    generatedMedia: v.optional(
      v.object({
        successVideo: v.optional(v.string()),
        failureVideo: v.optional(v.string()),
      })
    ),
    mediaStatus: v.optional(v.string()),
    // The verdict film (M5): the act_two full-room cut — the whole panel in
    // one shot, the speaker delivering the one-line verdict. Absent on
    // reports that predate the feature or whose speaker has no Runway
    // avatar/room scene — the verdict screen falls back to the still
    // composite. Generated exactly once, when the report is created; url is
    // a durable Convex storage URL.
    verdictVideo: v.optional(
      v.object({
        status: v.union(
          v.literal("pending"),
          v.literal("ready"),
          v.literal("failed")
        ),
        url: v.optional(v.string()),
        speakerId: v.string(),
        speakerName: v.string(),
        script: v.string(),
        // Legacy two-stage shape (removed): these docs hold the film here
        // and a talking-head clip in url. Kept optional so they still
        // validate; new reports write the film to url and never this.
        roomVideo: v.optional(
          v.object({
            status: v.union(
              v.literal("pending"),
              v.literal("ready"),
              v.literal("failed")
            ),
            url: v.optional(v.string()),
          })
        ),
      })
    ),
  }).index("by_simulation", ["simulationId"]),
})
