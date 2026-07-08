"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { formatDay } from "@/lib/utils"
import { TranscriptPanel } from "@/components/simulation/room/TranscriptPanel"
import { LiveNotes } from "@/components/simulation/room/LiveNotes"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"

const SessionDetailPage = ({ params }: { params: Promise<{ roomId: string }> }) => {
  const { roomId } = use(params)
  const room = useQuery(api.rooms.get, { id: roomId as Id<"rooms"> })
  const simulation = useQuery(
    api.simulations.get,
    room ? { id: room.simulationId } : "skip"
  )

  if (room === undefined) {
    return <div className="h-64 animate-pulse bg-surface-2" />
  }

  if (room === null) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        This session doesn&apos;t exist.{" "}
        <Link href="/sessions" className="focus-ring underline hover:text-red-fg">
          Back to sessions
        </Link>
        .
      </p>
    )
  }

  const panelist = room.characters[0]

  return (
    <div>
      <Link
        href="/sessions"
        className="focus-ring mb-[18px] flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2 hover:text-red-fg"
      >
        ← Back to sessions
      </Link>

      <div className="flex items-start justify-between gap-6 max-md:flex-col">
        <div>
          <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold tracking-[-.01em]">
            {simulation?.brief.ideaName ?? "Session"}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-3">
            {panelist ? `${panelist.name} · ${panelist.role}` : "No panelist"} ·{" "}
            {formatDay(room._creationTime)} · {room.transcript.length} turns
          </p>
        </div>
        <div className="flex items-center gap-3">
          {room.verdict && <VerdictBadge decision={room.verdict.decision} className="px-[11px] py-[5px] text-[11px]" />}
          {room.status === "live" && (
            <Link
              href={`/simulation/${room.simulationId}/room`}
              className="focus-ring border border-red bg-red px-4 py-2.5 font-mono text-[11px] uppercase tracking-[.08em] text-white transition-colors hover:bg-red-deep"
            >
              Rejoin the room →
            </Link>
          )}
        </div>
      </div>

      {room.verdict && (
        <p className="mt-4 max-w-[70ch] border-l-2 border-line-2 pl-4 text-[14px] leading-[1.55] text-on-surface-2">
          {room.verdict.summary}
        </p>
      )}

      <div className="mt-7 grid items-start gap-[22px] md:grid-cols-[1.25fr_1fr]">
        <div className="h-[520px] border border-line-2 bg-surface-raised">
          <TranscriptPanel transcript={room.transcript} startedAt={room._creationTime} />
        </div>
        <div className="h-[520px] border border-line-2 bg-surface-raised">
          <LiveNotes notes={room.liveNotes} startedAt={room._creationTime} />
        </div>
      </div>
    </div>
  )
}

export default SessionDetailPage
