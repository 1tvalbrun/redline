import { NextRequest, NextResponse } from "next/server"
import RunwayML from "@runwayml/sdk"

const runway = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET,
})

export const POST = async (req: NextRequest) => {
  const { avatarId, presetId } = await req.json()

  if (!avatarId && !presetId) {
    return NextResponse.json({ error: "avatarId or presetId is required" }, { status: 400 })
  }

  const avatar = presetId
    ? { type: "runway-preset" as const, presetId }
    : { type: "custom" as const, avatarId }

  const session = await runway.realtimeSessions.create({
    model: "gwm1_avatars",
    avatar,
  })

  const maxAttempts = 30
  for (let i = 0; i < maxAttempts; i++) {
    const status = await runway.realtimeSessions.retrieve(session.id)
    if (status.status === "READY") {
      return NextResponse.json({
        sessionId: session.id,
        sessionKey: status.sessionKey,
      })
    }
    if (status.status === "FAILED") {
      return NextResponse.json({ error: "Session failed to start" }, { status: 500 })
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return NextResponse.json({ error: "Session timed out" }, { status: 504 })
}
