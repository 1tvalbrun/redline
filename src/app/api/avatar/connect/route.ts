import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import RunwayML from "@runwayml/sdk"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

const RUNWAY_API = "https://api.dev.runwayml.com"

const BodySchema = z.object({ avatarId: z.string().min(1) })

// Runway's consume response is an external boundary like any other: a
// malformed payload should fail loudly here, not as an opaque client-side
// connect error holding once-consumable credentials.
const ConsumeSchema = z.object({
  url: z.string().min(1),
  token: z.string().min(1),
  roomName: z.string().min(1),
})

// The mint half — authorization, the billable connect claim, briefing
// composition, and the Runway session create — lives in Convex
// (avatars.mint), called with the caller's own token so every read inside
// is ownership-scoped. It moved there so the blueprint's sealed fields
// (questionPlan, rubric) never ride through a public query; this route only
// ever sees the Runway session id. The route keeps what needs its own
// Runway key and wall-clock patience: the READY poll, the consume exchange,
// and the best-effort cancel on every path that strands a minted session.
export const POST = async (req: NextRequest) => {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "avatarId required" }, { status: 400 })
  const { avatarId } = body.data

  // If the token or the env is missing, nothing can be authorized — refuse
  // (fail closed), same as an unknown avatar.
  const convexToken = await getToken({ template: "convex" }).catch(() => null)
  if (!convexToken || !process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
  }
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  convex.setAuth(convexToken)

  const convexSessionId = req.nextUrl.searchParams.get("sessionId")
  if (!convexSessionId) return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
  const clientId = req.nextUrl.searchParams.get("clientId")
  if (!clientId) {
    return NextResponse.json({ error: "Missing client id", code: "unavailable" }, { status: 400 })
  }

  // A thrown action covers both a malformed session id and a Runway create
  // failure; neither authorizes anything, and the client treats every
  // refusal without a distinct code as "unavailable".
  const mint = await convex
    .action(api.avatars.mint, {
      sessionId: convexSessionId as Id<"sessions">,
      clientId,
      avatarId,
    })
    .catch((err) => {
      console.warn("[/api/avatar/connect] mint failed:", err)
      return null
    })
  if (mint === null) {
    // The action may have completed — Runway session created, id persisted —
    // with only its response lost in transport. That ghost would bill and
    // hold the org's single concurrency slot for its full five minutes, so
    // sweep it from the doc's record. The claim's clientId gate means a
    // session another tab minted and still owns is never touched: this
    // sweep only fires when this client won the claim.
    const doc = await convex
      .query(api.sessions.get, { id: convexSessionId as Id<"sessions"> })
      .catch(() => null)
    if (doc?.roomClientId === clientId && doc.runwaySessionId) {
      await new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET }).realtimeSessions
        .delete(doc.runwaySessionId)
        .catch((err) => {
          console.warn("[/api/avatar/connect] ghost sweep after lost mint failed:", err)
        })
    }
    return NextResponse.json(
      { error: "Couldn't verify the session. Try again.", code: "unavailable" },
      { status: 503 }
    )
  }
  if (!mint.ok) {
    if (mint.code === "complete") {
      return NextResponse.json(
        { error: "This session's time is up.", code: "complete" },
        { status: 409 }
      )
    }
    if (mint.code === "cap") {
      return NextResponse.json(
        { error: "Connection limit reached for this session", code: "cap" },
        { status: 429 }
      )
    }
    if (mint.code === "unknown_avatar") {
      return NextResponse.json({ error: "Unknown avatar" }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Couldn't verify the session. Try again.", code: "unavailable" },
      { status: 503 }
    )
  }
  const { runwaySessionId } = mint

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })

  const deadline = Date.now() + 60_000
  let sessionKey = ""
  let sawQueued = false
  while (Date.now() < deadline) {
    const status = await client.realtimeSessions.retrieve(runwaySessionId)
    if (status.status === "READY") {
      sessionKey = status.sessionKey
      break
    }
    if (status.status === "FAILED") {
      return NextResponse.json({ error: "Session failed", code: "failed" }, { status: 500 })
    }
    if (status.status === "NOT_READY" && status.queued) sawQueued = true
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (!sessionKey) {
    // An abandoned session must not hold the org's concurrency slot or run
    // for nobody — cancel is best-effort, the refusal is not.
    await client.realtimeSessions.delete(runwaySessionId).catch((err) => {
      console.warn("[/api/avatar/connect] cancel after timeout failed:", err)
    })
    if (sawQueued) {
      return NextResponse.json(
        { error: "All panelists are in session.", code: "queued" },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Session timed out", code: "timeout" }, { status: 504 })
  }

  const consumeRes = await fetch(`${RUNWAY_API}/v1/realtime_sessions/${runwaySessionId}/consume`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${sessionKey}`, "Content-Type": "application/json" },
  })

  if (!consumeRes.ok) {
    // The client never learns this session's id (handleConnect throws on the
    // refusal), so nobody else can release it — same best-effort cancel the
    // timeout path does, for the same reason: it would keep billing and hold
    // the org's concurrency slot.
    await client.realtimeSessions.delete(runwaySessionId).catch((err) => {
      console.warn("[/api/avatar/connect] cancel after consume failure failed:", err)
    })
    return NextResponse.json({ error: "Consume failed", code: "failed" }, { status: 500 })
  }

  const consumed = ConsumeSchema.safeParse(await consumeRes.json().catch(() => null))
  if (!consumed.success) {
    console.error("[/api/avatar/connect] malformed consume response:", consumed.error)
    // Credentials were minted but can't be handed over: the session would
    // run for nobody — same best-effort release as the branches above.
    await client.realtimeSessions.delete(runwaySessionId).catch((err) => {
      console.warn("[/api/avatar/connect] cancel after malformed consume failed:", err)
    })
    return NextResponse.json({ error: "Consume failed", code: "failed" }, { status: 500 })
  }
  return NextResponse.json({
    sessionId: runwaySessionId,
    serverUrl: consumed.data.url,
    token: consumed.data.token,
    roomName: consumed.data.roomName,
  })
}
