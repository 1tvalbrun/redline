import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import type { ActionCtx } from "./_generated/server"

// Speaker-centered room scenes (gen4_image composites of the full panel,
// uploaded once to Convex storage — see docs in the PR). A speaker without
// a scene gets no film; reports.generate checks this before promising one.
export const ROOM_SCENE_ENV: Record<string, string | undefined> = {
  "vc-01": process.env.VERDICT_ROOM_SCENE_VC,
  "tc-01": process.env.VERDICT_ROOM_SCENE_TC,
  "ta-01": process.env.VERDICT_ROOM_SCENE_TA,
}

const storeClip = async (ctx: ActionCtx, signedUrl: string) => {
  const clip = await fetch(signedUrl)
  if (!clip.ok) throw new Error(`Clip download failed: ${clip.status}`)
  const storageId = await ctx.storage.store(await clip.blob())
  const url = await ctx.storage.getUrl(storageId)
  if (!url) throw new Error("Convex storage returned no URL")
  return url
}

// The verdict film: one video of the whole panel in the room, the delivering
// panelist speaking the one-line verdict in their own configured voice, the
// others present but silent. Built in two Runway calls, but only the final
// cut is ever shown:
//   1. avatar_videos — lip-synced talking-head performance (~35s). Internal
//      only: it exists to drive act_two and is never presented or stored
//      (its signed URL is consumed within minutes, well inside 24-48h
//      validity).
//   2. act_two — the performance drives the speaker-centered room scene
//      (~4 min; bodyControl off — with it on, hands smear and the silent
//      panelists gesture along, verified live).
// The cut is copied into Convex storage (Runway's signed URLs expire within
// 24-48h; the film is paid for exactly once per report). Any failure marks
// the video failed — the report never falls back to the talking head.
export const generateVerdictVideo = internalAction({
  args: {
    reportId: v.id("reports"),
    avatarId: v.string(),
    speakerId: v.string(),
    script: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.RUNWAYML_API_SECRET
      if (!apiKey) {
        throw new Error("RUNWAYML_API_SECRET not configured in Convex env")
      }
      const sceneUrl = ROOM_SCENE_ENV[args.speakerId]
      if (!sceneUrl) {
        throw new Error(`No room scene configured for speaker ${args.speakerId}`)
      }

      const RunwayML = (await import("@runwayml/sdk")).default
      const runway = new RunwayML({ apiKey })

      console.log("[runway.generateVerdictVideo] performance starting", {
        reportId: args.reportId,
        avatarId: args.avatarId,
      })

      // Awaited in two steps: chaining .waitForTaskOutput() directly onto
      // create() leaves the create request's rejection unhandled when the
      // API returns 400, which kills the action before the catch below can
      // mark the video failed (observed live — report stuck "pending").
      const created = await runway.avatarVideos.create({
        model: "gwm1_avatars",
        avatar: { type: "custom", avatarId: args.avatarId },
        speech: { type: "text", text: args.script },
      })
      const result = await runway.tasks.retrieve(created.id).waitForTaskOutput()

      const performanceUrl = result.output?.[0]
      if (!performanceUrl) throw new Error("Runway returned no performance URL")

      console.log("[runway.generateVerdictVideo] film starting", {
        reportId: args.reportId,
        speakerId: args.speakerId,
      })

      const performance = await runway.characterPerformance.create({
        model: "act_two",
        character: { type: "image", uri: sceneUrl },
        reference: { type: "video", uri: performanceUrl },
        ratio: "1280:720",
        bodyControl: false,
      })
      const performed = await runway.tasks
        .retrieve(performance.id)
        .waitForTaskOutput()

      const signedUrl = performed.output?.[0]
      if (!signedUrl) throw new Error("Runway returned no film URL")
      const url = await storeClip(ctx, signedUrl)

      console.log("[runway.generateVerdictVideo] film ready:", url)

      await ctx.runMutation(internal.reports.setVerdictVideoStatus, {
        id: args.reportId,
        status: "ready",
        url,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[runway.generateVerdictVideo] failed:", message, err)
      try {
        await ctx.runMutation(internal.reports.setVerdictVideoStatus, {
          id: args.reportId,
          status: "failed",
        })
      } catch {}
    }
  },
})
