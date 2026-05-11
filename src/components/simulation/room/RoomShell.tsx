"use client"

import { useRef, useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { DEFAULT_CHARACTERS } from "../characters"
import { RoomHeader } from "./RoomHeader"
import { AvatarPanelGrid } from "./AvatarPanelGrid"
import { UserTile } from "./UserTile"
import { PromptHelpers } from "./PromptHelpers"
import { TranscriptPanel } from "./TranscriptPanel"
import { RiskMeter } from "./RiskMeter"
import { LiveNotes } from "./LiveNotes"

const deriveRound = (turns: number) => {
  if (turns >= 15) return "VERDICT"
  if (turns >= 9) return "CROSS-EXAMINATION"
  if (turns >= 4) return "CHALLENGE"
  return "OVERVIEW"
}

const formatElapsed = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

type RoomShellProps = {
  simulationId: string
}

export const RoomShell = ({ simulationId }: RoomShellProps) => {
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const room = useQuery(api.rooms.getBySimulation, { simulationId: typedId })
  const createRoom = useMutation(api.rooms.create)
  const initialized = useRef(false)

  // Timer — synchronize with system clock (legitimate useEffect per React docs)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!room?._creationTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - room._creationTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [room?._creationTime])

  // Loading
  if (room === undefined || simulation === undefined) return null

  // Auto-create room if navigated directly (normal flow creates via PanelSetup)
  if (room === null) {
    if (!initialized.current) {
      initialized.current = true
      createRoom({ simulationId: typedId, characters: DEFAULT_CHARACTERS })
    }
    return null
  }

  const round = deriveRound(room.transcript.length)
  const handleEndSession = () => {}
  const handlePromptSelect = (_prompt: string) => {}

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <RoomHeader
        simulationName={simulation?.title ?? ""}
        round={round}
        elapsedTime={formatElapsed(elapsed)}
        onEndSession={handleEndSession}
      />
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <AvatarPanelGrid
          characters={room.characters}
          activeCharacterId={room.activeCharacterId}
        />
        <div className="flex flex-1 gap-3 min-h-0">
          <div className="flex w-[180px] shrink-0 flex-col gap-3">
            <UserTile
              userName="Founder"
              simulationName={simulation?.title ?? ""}
            />
            <PromptHelpers onSelect={handlePromptSelect} />
          </div>
          <div className="flex-1 min-w-0">
            <TranscriptPanel
              transcript={room.transcript}
              characters={room.characters}
            />
          </div>
          <div className="flex w-[280px] shrink-0 flex-col gap-3">
            <RiskMeter scores={room.riskScores} />
            <LiveNotes notes={room.liveNotes} />
          </div>
        </div>
      </div>
    </div>
  )
}
