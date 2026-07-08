"use client"

import { use } from "react"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { RoomShell } from "@/components/simulation/room/RoomShell"

const RoomPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return (
    <FlowShell stage="room" simulationId={id} fullBleed>
      <RoomShell simulationId={id} />
    </FlowShell>
  )
}

export default RoomPage
