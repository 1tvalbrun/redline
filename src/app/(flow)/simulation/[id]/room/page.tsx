"use client"

import { use } from "react"
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

  // "Session 4 · CourtTime production · Data recovery" — the live session
  // is the newest, so its number is the total count. The third segment is
  // the session's focus where the lane has one (audit's control area).
  const focus = practice
    ? scopeText(practice.scope, "controlArea") || getPack(practice.packId).shortLabel
    : null
  const meta =
    practice && sessions?.length ? (
      <p className="font-mono text-[11px] uppercase tracking-[.04em] text-on-surface-3">
        Session {sessions.length} ·{" "}
        <b className="font-medium text-on-surface-2">{practice.name}</b> · {focus}
      </p>
    ) : undefined

  return (
    <FlowShell
      stage="room"
      simulationId={id}
      fullBleed
      dark
      centerSlot={meta}
      confirmExit={{
        label: "Leave room",
        confirmLabel: "Leave",
        title: "Leave the room?",
        description:
          "Your session stays live and you can rejoin from this practice. If you're finished, use End session instead. That's what gets you your debrief.",
      }}
    >
      <RoomShell simulationId={id} />
    </FlowShell>
  )
}

export default RoomPage
