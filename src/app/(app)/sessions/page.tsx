"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { formatDay } from "@/lib/utils"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"

const SessionsPage = () => {
  const sessions = useQuery(api.rooms.list)

  return (
    <div>
      <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">Sessions</h1>
      <p className="mt-2 max-w-[52ch] text-[14px] text-on-surface-2">
        Every interrogation you&apos;ve run, with the transcript and the panel&apos;s
        turn-by-turn notes.
      </p>

      <div className="mt-6">
        {sessions === undefined ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse bg-surface-2" />
            <div className="h-12 animate-pulse bg-surface-2" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[13.5px] text-on-surface-2">
            No sessions yet. Enter the room and the recording lands here.{" "}
            <Link href="/simulation/new" className="focus-ring underline hover:text-red-fg">
              Start a stress test
            </Link>
            .
          </p>
        ) : (
          <ul>
            {sessions.map((session) => (
              <li key={session.roomId}>
                <Link
                  href={`/sessions/${session.roomId}`}
                  className="focus-ring grid grid-cols-[64px_1fr_110px_80px] items-center gap-4 border-b border-line px-3.5 py-3.5 transition-colors hover:bg-surface-raised max-md:grid-cols-[64px_1fr_80px]"
                >
                  <span className="font-mono text-[11px] text-on-surface-3">{formatDay(session.at)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-base font-bold tracking-[-.01em]">
                      {session.ideaName}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[.04em] text-on-surface-3">
                      {session.panelist ?? "No panelist"} · {session.turns} turns
                    </span>
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface-3 max-md:hidden">
                    {session.status === "live" ? (
                      <span className="text-red-fg">● In session</span>
                    ) : (
                      "Concluded"
                    )}
                  </span>
                  <span>{session.decision && <VerdictBadge decision={session.decision} />}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default SessionsPage
