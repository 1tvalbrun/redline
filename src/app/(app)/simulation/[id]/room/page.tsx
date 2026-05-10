"use client"

import { use } from "react"
import { RoomShell } from "@/components/simulation/room/RoomShell"

const RoomPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)

  return <RoomShell simulationId={id} />
}

export default RoomPage
