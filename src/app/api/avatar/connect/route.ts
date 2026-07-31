import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import RunwayML from "@runwayml/sdk"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { buildRoomBriefing, type RoomBriefing } from "@/lib/roomBriefing"

const RUNWAY_API = "https://api.dev.runwayml.com"

const BodySchema = z.object({ avatarId: z.string().min(1) })

// Sessions are billable, so the route only mints them for the three
// panelists this app actually fields — not any avatar in the Runway org.
// With no ids configured the set is empty and every request is refused
// (fail closed), which matches a client that couldn't connect anyway.
const ALLOWED_AVATAR_IDS = new Set(
  [
    process.env.NEXT_PUBLIC_RUNWAY_AVATAR_VC,
    process.env.NEXT_PUBLIC_RUNWAY_AVATAR_CUSTOMER,
    process.env.NEXT_PUBLIC_RUNWAY_AVATAR_TECH,
  ].filter(Boolean)
)

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

// Best-effort session briefing: the simulation, audit, and room are read
// through the caller's own Convex token, so ownership scoping applies — a
// simulationId the caller doesn't own reads as missing and the session
// simply connects unbriefed (canned opener, stored persona).
const fetchBriefing = async (
  simulationId: string | null,
  convexToken: string | null
): Promise<RoomBriefing | null> => {
  if (!simulationId || !convexToken || !process.env.NEXT_PUBLIC_CONVEX_URL) return null
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
    convex.setAuth(convexToken)
    // A malformed id fails Convex's argument validation inside the try —
    // same degraded outcome as any other briefing failure.
    const id = simulationId as Id<"simulations">
    const [simulation, audit, room] = await Promise.all([
      convex.query(api.simulations.get, { id }),
      convex.query(api.audits.getBySimulation, { simulationId: id }),
      convex.query(api.rooms.getBySimulation, { simulationId: id }),
    ])
    if (!simulation) return null
    return buildRoomBriefing({
      ideaName: simulation.brief.ideaName,
      description: simulation.brief.description,
      audit: audit ? { claims: audit.claims, gaps: audit.gaps } : null,
      transcript: room?.transcript ?? [],
    })
  } catch (err) {
    console.warn("[/api/avatar/connect] briefing fetch failed:", err)
    return null
  }
}

// Best-effort: if the persona can't be fetched, the session connects with
// the avatar's stored personality (server-side default) rather than failing.
const fetchStoredPersonality = async (
  client: RunwayML,
  avatarId: string
): Promise<string | null> => {
  try {
    const avatar = await client.avatars.retrieve(avatarId)
    return avatar.status === "READY" && avatar.personality ? avatar.personality : null
  } catch (err) {
    console.warn("[/api/avatar/connect] personality fetch failed:", err)
    return null
  }
}

export const POST = async (req: NextRequest) => {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "avatarId required" }, { status: 400 })
  const { avatarId } = body.data
  if (!ALLOWED_AVATAR_IDS.has(avatarId)) {
    return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
  }

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })

  // Independent fetches, in parallel — the connect path is already long
  // (session create + READY poll).
  const [briefing, storedPersonality] = await Promise.all([
    getToken({ template: "convex" })
      .catch(() => null)
      .then((token) => fetchBriefing(req.nextUrl.searchParams.get("simulationId"), token)),
    fetchStoredPersonality(client, avatarId),
  ])

  let personality: string | undefined
  if (storedPersonality) {
    personality = `${TURN_TAKING_RULES}${briefing?.personalityPreamble ?? ""}${storedPersonality}`
    console.log(
      `[/api/avatar/connect] session personality override applied (${personality.length} chars)`
    )
  }

  const session = await client.realtimeSessions.create({
    model: "gwm1_avatars",
    avatar: { type: "custom", avatarId },
    ...(personality ? { personality } : {}),
    // Replaces the Character's canned opener, which otherwise repeats
    // verbatim every session — including resumes.
    ...(briefing ? { startScript: briefing.startScript } : {}),
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
