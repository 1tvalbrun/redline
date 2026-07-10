import { NextRequest, NextResponse } from "next/server"
import RunwayML from "@runwayml/sdk"

const RUNWAY_API = "https://api.dev.runwayml.com"

// The GWM engine fills founder pauses with presence check-ins ("Still with
// me?"), which reads as the avatar not listening. The session-level
// personality override is the only turn-taking lever the API exposes, so the
// stored persona is extended with explicit pause rules for each session.
const TURN_TAKING_RULES = `Pause policy (absolute, highest priority): \
Never comment on silence or check the founder's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
founder pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: press, question, and challenge exactly as your character \
demands.

`

export const POST = async (req: NextRequest) => {
  const { avatarId } = await req.json()
  if (!avatarId) return NextResponse.json({ error: "avatarId required" }, { status: 400 })

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })

  // Best-effort: if the persona can't be fetched, connect with the avatar's
  // stored personality rather than failing the session.
  let personality: string | undefined
  try {
    const avatar = await client.avatars.retrieve(avatarId)
    if (avatar.status === "READY" && avatar.personality) {
      personality = `${TURN_TAKING_RULES}${avatar.personality}`
      console.log(
        `[/api/avatar/connect] session personality override applied (${personality.length} chars)`
      )
    }
  } catch (err) {
    console.warn("[/api/avatar/connect] personality fetch failed:", err)
  }

  const session = await client.realtimeSessions.create({
    model: "gwm1_avatars",
    avatar: { type: "custom", avatarId },
    ...(personality ? { personality } : {}),
  })

  const deadline = Date.now() + 60_000
  let sessionKey = ""
  while (Date.now() < deadline) {
    const status = await client.realtimeSessions.retrieve(session.id)
    if (status.status === "READY") { sessionKey = status.sessionKey; break }
    if (status.status === "FAILED") return NextResponse.json({ error: "Session failed" }, { status: 500 })
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (!sessionKey) return NextResponse.json({ error: "Session timed out" }, { status: 504 })

  const consumeRes = await fetch(`${RUNWAY_API}/v1/realtime_sessions/${session.id}/consume`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${sessionKey}`, "Content-Type": "application/json" },
  })

  if (!consumeRes.ok) return NextResponse.json({ error: "Consume failed" }, { status: 500 })

  const data = await consumeRes.json()
  return NextResponse.json({
    sessionId: session.id,
    serverUrl: data.url,
    token: data.token,
    roomName: data.roomName,
  })
}
