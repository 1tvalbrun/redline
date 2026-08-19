import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import RunwayML from "@runwayml/sdk"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import type { RoomBriefing } from "@/domains/types"

const RUNWAY_API = "https://api.dev.runwayml.com"

const BodySchema = z.object({ avatarId: z.string().min(1) })

type SessionContext = {
  briefing: RoomBriefing
  turnTaking: string
}

// Runway sessions are billable, so minting one requires an owned, live
// session that features the requested avatar. Reads run through the
// caller's own Convex token, so ownership scoping applies: someone else's
// session reads as missing, and any failure — malformed id, unowned
// session, transient query error — authorizes nothing (fail closed). The
// same reads feed the session briefing.
const authorizeSession = async (
  convex: ConvexHttpClient,
  sessionId: string | null,
  avatarId: string
): Promise<SessionContext | null> => {
  if (!sessionId) return null
  try {
    const id = sessionId as Id<"sessions">
    const session = await convex.query(api.sessions.get, { id })
    if (!session) return null
    if (session.status !== "live") return null
    if (session.persona.avatarId !== avatarId) return null
    const practice = await convex.query(api.practices.get, { id: session.practiceId })
    if (!practice) return null
    const pack = getPack(practice.packId)
    return {
      briefing: pack.briefing({
        scope: practice.scope,
        audit: practice.audit
          ? { claims: practice.audit.claims, gaps: practice.audit.gaps }
          : null,
        blueprint: practice.blueprint ?? null,
        continuity: practice.continuity ?? null,
        transcript: session.transcript,
      }),
      turnTaking: pack.turnTaking,
    }
  } catch (err) {
    console.warn("[/api/avatar/connect] session authorization failed:", err)
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

  // Sessions are billable, so the route only mints them for avatars in the
  // Convex registry (convex/avatars.ts). The check runs with the caller's
  // own token; if the token or the query fails, the request is refused
  // (fail closed).
  const convexToken = await getToken({ template: "convex" }).catch(() => null)
  if (!convexToken || !process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
  }
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  convex.setAuth(convexToken)
  const allowed = await convex
    .query(api.avatars.allowed, { runwayAvatarId: avatarId })
    .catch(() => false)
  if (!allowed) return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })

  // Independent fetches, in parallel; the connect path is already long
  // (session create + READY poll).
  const convexSessionId = req.nextUrl.searchParams.get("sessionId")
  const [authorized, storedPersonality] = await Promise.all([
    authorizeSession(convex, convexSessionId, avatarId),
    fetchStoredPersonality(client, avatarId),
  ])
  if (!authorized) return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
  const { briefing, turnTaking } = authorized

  let personality: string | undefined
  if (storedPersonality) {
    personality = `${turnTaking}${briefing.personalityPreamble}${storedPersonality}`
    console.log(
      `[/api/avatar/connect] session personality override applied (${personality.length} chars)`
    )
  }

  const session = await client.realtimeSessions.create({
    model: "gwm1_avatars",
    avatar: { type: "custom", avatarId },
    ...(personality ? { personality } : {}),
    // Replaces the Character's canned opener, which otherwise repeats
    // verbatim every session, including resumes.
    startScript: briefing.startScript,
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

  // Every mint is billed (retries and refreshes included), so every mint is
  // metered. Best-effort: a failed write must not break the connect.
  await convex
    .mutation(api.usage.recordAvatarConnect, {
      sessionId: convexSessionId as Id<"sessions">,
    })
    .catch((err) => console.warn("[/api/avatar/connect] usage record failed:", err))

  const data = await consumeRes.json()
  return NextResponse.json({
    sessionId: session.id,
    serverUrl: data.url,
    token: data.token,
    roomName: data.roomName,
  })
}
