"use client"

import { use, useCallback, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { RoomShell } from "@/components/simulation/room/RoomShell"

const RoomPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const practice = useQuery(api.practices.get, { id: id as Id<"practices"> })
  const sessions = useQuery(api.sessions.listByPractice, { practiceId: id as Id<"practices"> })
  // The settle fades everything, including the flow header this page owns
  // through FlowShell — the room reports the moment, the page relays it.
  const [settled, setSettled] = useState(false)
  const handleSettled = useCallback(() => setSettled(true), [])

  // "Session 4 · CourtTime production · Data recovery" — the live session
  // is the newest, so its number is the total count. The third segment is
  // the session's focus where the lane has one (audit's control area).
  const pack = practice ? getPack(practice.packId) : null
  const focus =
    practice && pack
      ? (pack.sessionMetaField ? scopeText(practice.scope, pack.sessionMetaField) : "") ||
        pack.shortLabel
      : null
  const meta =
    practice && sessions?.length ? (
      <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[.04em] text-on-surface-3">
        Session {sessions.length}
        <span className="max-md:hidden">
          {" "}
          · <b className="font-medium text-on-surface-2">{practice.name}</b> · {focus}
        </span>
      </p>
    ) : undefined

  return (
    <FlowShell
      stage="room"
      simulationId={id}
      fullBleed
      dark
      chromeFaded={settled}
      centerSlot={meta}
      confirmExit={{
        label: "Leave room",
        confirmLabel: "Leave",
        title: "Leave the room?",
        description:
          "Your session stays live and you can rejoin from this practice. If you're finished, use End session instead. That's what gets you your debrief.",
      }}
    >
      <RoomShell simulationId={id} onSettled={handleSettled} />
    </FlowShell>
  )
}

export default RoomPage
