"use client"

import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { AvatarPanelGrid } from "./AvatarPanelGrid"
import { TranscriptPanel } from "./TranscriptPanel"
import { RiskMeter } from "./RiskMeter"
import { LiveNotes } from "./LiveNotes"

type RoomShellProps = {
  simulationId: string
}

export const RoomShell = ({ simulationId }: RoomShellProps) => {
  const room = useQuery(api.rooms.getBySimulation, {
    simulationId: simulationId as Id<"simulations">,
  })

  if (!room) return <p className="text-muted-foreground">Loading room...</p>

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="flex flex-1 flex-col gap-4">
        <AvatarPanelGrid characters={room.characters} activeCharacterId={room.activeCharacterId} />
        <TranscriptPanel transcript={room.transcript} />
      </div>
      <div className="flex w-72 flex-col gap-4">
        <RiskMeter scores={room.riskScores} />
        <LiveNotes notes={room.liveNotes} />
      </div>
    </div>
  )
}
