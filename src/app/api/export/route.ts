import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ConvexHttpClient } from "convex/browser"
import { renderToBuffer } from "@react-pdf/renderer"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { findVerdict, getPack } from "@/domains/registry"
import { blockersFirst, exportFilename, parseOpenQuestions } from "@/lib/export"
import { practiceReport } from "@/lib/pdf/PracticeReport"
import { sessionDebrief } from "@/lib/pdf/SessionDebrief"

// Every read below goes through the same ownership-scoped public queries the
// pages use (requireIdentity + ownedOrNull), with the caller's own token —
// the route can only ever export what its caller can already see. Sealed
// blueprint fields and raw material text are excluded by construction:
// practices.get redacts the blueprint, and nothing here reads materials.
export const GET = async (req: NextRequest) => {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const convexToken = await getToken({ template: "convex" }).catch(() => null)
  if (!convexToken || !process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  convex.setAuth(convexToken)

  const practiceId = req.nextUrl.searchParams.get("practiceId")
  const sessionId = req.nextUrl.searchParams.get("sessionId")
  const exportedAt = Date.now()

  if (sessionId) {
    // ownedOrNull already yields null for missing or foreign docs, so a
    // catch here is a real failure (malformed id, Convex unreachable) —
    // log it or an outage debugs as a silent 404.
    const session = await convex
      .query(api.sessions.get, { id: sessionId as Id<"sessions"> })
      .catch((err) => {
        console.warn("[/api/export] session read failed:", err)
        return null
      })
    if (!session?.debrief) {
      return NextResponse.json({ error: "Nothing to export yet" }, { status: 404 })
    }
    const practice = await convex
      .query(api.practices.get, { id: session.practiceId })
      .catch((err) => {
        console.warn("[/api/export] practice read failed:", err)
        return null
      })
    if (!practice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { debrief } = session
    const buffer = await renderToBuffer(
      sessionDebrief({
        practiceName: practice.name,
        personaName: session.persona.name,
        sessionDate: session._creationTime,
        exportedAt,
        title: debrief.title,
        verdictLabel: findVerdict(debrief.verdict)?.label ?? debrief.verdict,
        verdictSummary: debrief.verdictSummary,
        spokenVerdict: debrief.spokenVerdict.text,
        whatHappened: debrief.whatHappened,
        heldUp: debrief.heldUp,
        didntHold: debrief.didntHold,
        verifyItems: debrief.verifyItems ?? [],
        actionItems: (practice.continuity?.actionItems ?? []).flatMap(
          ({ text, priority, status, fromSessionId }) =>
            fromSessionId === session._id && status !== "dropped"
              ? [{ text, priority, status }]
              : []
        ),
      })
    )
    return pdfResponse(buffer, exportFilename(practice.name, "debrief"))
  }

  if (practiceId) {
    const practice = await convex
      .query(api.practices.get, { id: practiceId as Id<"practices"> })
      .catch((err) => {
        console.warn("[/api/export] practice read failed:", err)
        return null
      })
    if (!practice) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const sessions = await convex.query(api.sessions.listByPractice, {
      practiceId: practice._id,
    })

    const pack = getPack(practice.packId)
    const audit = practice.audit?.status === "ready" ? practice.audit : null
    const buffer = await renderToBuffer(
      practiceReport({
        practiceName: practice.name,
        laneLabel: `${pack.label} lane`,
        personaName: pack.personas.find((p) => p.id === practice.personaId)?.name ?? null,
        exportedAt,
        claims: audit?.claims ?? [],
        gaps: blockersFirst(audit?.gaps ?? []),
        openQuestions: parseOpenQuestions(practice.context?.openQuestions),
        actionItems: (practice.continuity?.actionItems ?? []).flatMap(
          ({ text, priority, status }) =>
            status !== "dropped" ? [{ text, priority, status }] : []
        ),
        sessions: sessions.map((session) => ({
          startedAt: session.startedAt,
          verdictLabel: session.verdict
            ? findVerdict(session.verdict)?.label ?? session.verdict
            : null,
          title: session.title,
        })),
      })
    )
    return pdfResponse(buffer, exportFilename(practice.name, "report"))
  }

  return NextResponse.json({ error: "practiceId or sessionId required" }, { status: 400 })
}

const pdfResponse = (buffer: Buffer, filename: string) =>
  new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // User data — never cacheable.
      "Cache-Control": "no-store",
    },
  })
