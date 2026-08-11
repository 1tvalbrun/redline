"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

// The verdict now lives on the session debrief page. This route survives
// only so old links and the room's end-session path land somewhere sane:
// it forwards to the newest session's debrief, or the practice page when
// no session exists yet.
const ReportRedirectPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const router = useRouter()
  const sessions = useQuery(api.sessions.listByPractice, {
    practiceId: id as Id<"practices">,
  })

  useEffect(() => {
    if (sessions === undefined) return
    const newest = sessions[0]
    router.replace(newest ? `/p/${id}/s/${newest.sessionId}` : `/p/${id}`)
  }, [sessions, router, id])

  return null
}

export default ReportRedirectPage
