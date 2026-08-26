import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import RunwayML from "@runwayml/sdk"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

const BodySchema = z.object({
  sessionId: z.string().min(1),
  runwaySessionId: z.string().min(1),
})

// Releases a Runway session the client minted but never got an avatar out
// of, so it stops billing and stops holding the org's single concurrency
// slot (an abandoned session makes every retry queue behind it).
//
// Authorization model: possession of the Runway id is no longer the
// capability — ownership of the matching Convex session is. The caller
// names their Convex session; the read runs with their own token, so
// ownership scoping applies, and deletion proceeds only when that session's
// stored runwaySessionId equals the claimed one. Every refusal — unowned
// or missing session, mismatched or unrecorded Runway id — returns the
// same { ok: false } a failed delete does: no distinction, no existence
// leak, and the client fires and forgets either way.
export const DELETE = async (req: NextRequest) => {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "sessionId and runwaySessionId required" }, { status: 400 })
  }
  const { sessionId, runwaySessionId } = body.data

  const refused = NextResponse.json({ ok: false })
  const convexToken = await getToken({ template: "convex" }).catch(() => null)
  if (!convexToken || !process.env.NEXT_PUBLIC_CONVEX_URL) return refused
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  convex.setAuth(convexToken)
  const session = await convex
    .query(api.sessions.get, { id: sessionId as Id<"sessions"> })
    .catch(() => null)
  if (!session || session.runwaySessionId !== runwaySessionId) return refused

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET })
  try {
    await client.realtimeSessions.delete(runwaySessionId)
    console.log(`[/api/avatar/session] abandoned session deleted: ${runwaySessionId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.warn(`[/api/avatar/session] delete failed for ${runwaySessionId}:`, err)
    return NextResponse.json({ ok: false })
  }
}
