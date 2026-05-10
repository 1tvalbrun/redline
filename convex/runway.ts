import { v } from "convex/values"
import { action } from "./_generated/server"
import { api } from "./_generated/api"

export const generateMedia = action({
  args: {
    reportId: v.id("reports"),
    successPrompt: v.string(),
    failurePrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const skipVideo = process.env.SKIP_VIDEO_GENERATION === "true"
    if (skipVideo) {
      await ctx.runMutation(api.reports.updateMedia, {
        id: args.reportId,
        generatedMedia: {
          successVideo: "https://placeholder.video/success",
          failureVideo: "https://placeholder.video/failure",
        },
        mediaStatus: "skipped",
      })
      return
    }

    const RunwayML = (await import("@runwayml/sdk")).default
    const runway = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })

    await ctx.runMutation(api.reports.updateMedia, {
      id: args.reportId,
      generatedMedia: {},
      mediaStatus: "generating",
    })

    const [successTask, failureTask] = await Promise.all([
      runway.textToVideo.create({
        model: "gen4.5",
        promptText: args.successPrompt,
        duration: 5,
        ratio: "1280:720",
      }),
      runway.textToVideo.create({
        model: "gen4.5",
        promptText: args.failurePrompt,
        duration: 5,
        ratio: "1280:720",
      }),
    ])

    await ctx.runMutation(api.reports.updateMedia, {
      id: args.reportId,
      generatedMedia: {
        successVideo: successTask.id,
        failureVideo: failureTask.id,
      },
      mediaStatus: "complete",
    })
  },
})
