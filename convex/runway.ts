import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"

export const generateImage = action({
  args: {
    reportId: v.id("reports"),
    decision: v.string(),
    ideaName: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const isPositive = args.decision === "advance"

    const prompt = isPositive
      ? `Cinematic photorealistic scene: confident founder in a modern startup office at golden hour, presenting to engaged investors, optimistic atmosphere, soft natural light, warm color palette, shallow depth of field, professional editorial photography. Context: ${args.ideaName}.`
      : `Cinematic photorealistic scene: empty boardroom at dusk, scattered notebooks on a long table, dim laptop screens glowing, somber moody atmosphere, cool color palette, dramatic shadows, professional editorial photography evoking a missed opportunity. Context: ${args.ideaName}.`

    try {
      const RunwayML = (await import("@runwayml/sdk")).default
      const apiKey = process.env.RUNWAYML_API_SECRET
      if (!apiKey) {
        throw new Error("RUNWAYML_API_SECRET not configured in Convex env")
      }
      const runway = new RunwayML({ apiKey })

      await ctx.runMutation(api.reports.updateMedia, {
        id: args.reportId,
        generatedMedia: {},
        mediaStatus: "generating",
      })

      console.log("[runway.generateImage] starting", {
        decision: args.decision,
        ideaName: args.ideaName,
      })

      const result = await runway.textToImage
        .create({
          model: "gen4_image",
          promptText: prompt,
          ratio: "1920:1080",
        })
        .waitForTaskOutput()

      const url = result.output[0]
      if (!url) throw new Error("Runway returned no output URL")

      console.log("[runway.generateImage] succeeded:", url)

      await ctx.runMutation(api.reports.updateMedia, {
        id: args.reportId,
        generatedMedia: isPositive ? { successVideo: url } : { failureVideo: url },
        mediaStatus: "complete",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[runway.generateImage] failed:", message, err)
      try {
        await ctx.runMutation(api.reports.updateMedia, {
          id: args.reportId,
          generatedMedia: {},
          mediaStatus: `failed: ${message.slice(0, 180)}`,
        })
      } catch {}
    }
  },
})
