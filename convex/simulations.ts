import { v } from "convex/values"
import { mutation, query, action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { materialFileType, validateMaterialFile } from "../src/lib/materials"

export const create = mutation({
  args: {
    title: v.string(),
    roomType: v.string(),
    brief: v.object({
      ideaName: v.string(),
      stage: v.string(),
      description: v.string(),
      targetUser: v.string(),
      businessModel: v.string(),
      focusAreas: v.array(v.string()),
    }),
    materials: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const existingIdea = await ctx.db
      .query("ideas")
      .withIndex("by_name", (q) => q.eq("name", args.brief.ideaName))
      .first()
    const ideaId =
      existingIdea?._id ?? (await ctx.db.insert("ideas", { name: args.brief.ideaName }))
    const simulationId = await ctx.db.insert("simulations", {
      title: args.title,
      roomType: args.roomType,
      brief: args.brief,
      ideaId,
      status: "draft",
      version: 1,
    })

    for (const upload of args.materials ?? []) {
      // The client validates before uploading; anything invalid here is a
      // bypass, so reject loudly rather than ingest it.
      const fileType = materialFileType(upload.name)
      if (fileType === null || validateMaterialFile(upload.name, upload.size) !== null) {
        throw new Error(`Unsupported material: ${upload.name}`)
      }
      const materialId = await ctx.db.insert("materials", {
        simulationId,
        storageId: upload.storageId,
        name: upload.name,
        fileType,
        size: upload.size,
        status: "extracting",
      })
      await ctx.scheduler.runAfter(0, internal.ingest.extract, { materialId })
    }

    return simulationId
  },
})

export const get = query({
  args: { id: v.id("simulations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("simulations").order("desc").take(20)
  },
})

export const setStatus = mutation({
  args: {
    id: v.id("simulations"),
    status: v.union(
      v.literal("draft"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("live"),
      v.literal("complete")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status })
  },
})

export const setContext = mutation({
  args: {
    id: v.id("simulations"),
    context: v.object({
      problem: v.string(),
      targetCustomer: v.string(),
      coreAssumption: v.string(),
      revenueModel: v.string(),
      primaryRisk: v.string(),
      competitors: v.string(),
      openQuestions: v.string(),
    }),
    status: v.union(
      v.literal("draft"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("live"),
      v.literal("complete")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      context: args.context,
      status: args.status,
    })
  },
})

export const analyze = action({
  args: { id: v.id("simulations") },
  handler: async (ctx, args) => {
    const simulation = await ctx.runQuery(api.simulations.get, { id: args.id })
    if (!simulation) throw new Error("Simulation not found")

    await ctx.runMutation(api.simulations.setStatus, {
      id: args.id,
      status: "analyzing",
    })

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini"

    const brief = simulation.brief
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a business analyst. Extract structured context from a startup brief. Return JSON only with these fields: problem, targetCustomer, coreAssumption, revenueModel, primaryRisk, competitors, openQuestions. Each field is a string.`,
        },
        {
          role: "user",
          content: `Idea: ${brief.ideaName}\nStage: ${brief.stage}\nDescription: ${brief.description}\nTarget User: ${brief.targetUser}\nBusiness Model: ${brief.businessModel}\nFocus Areas: ${brief.focusAreas.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error("No response from OpenAI")

    const context = JSON.parse(content)

    await ctx.runMutation(api.simulations.setContext, {
      id: args.id,
      context,
      status: "ready",
    })

    return context
  },
})
