"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { AvatarProvider, AvatarVideo } from "@runwayml/avatars-react"
import { DEFAULT_CHARACTERS } from "../characters"
import { RoomHeader } from "./RoomHeader"
import { UserTile } from "./UserTile"
import { PromptHelpers } from "./PromptHelpers"
import { TranscriptPanel } from "./TranscriptPanel"
import { LiveNotes } from "./LiveNotes"
import { TranscriptBridge } from "./TranscriptBridge"
import { MicBridge } from "./MicBridge"
import { UserSpeechBridge } from "./UserSpeechBridge"

type RoomShellProps = {
  simulationId: string
}

export const RoomShell = ({ simulationId }: RoomShellProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const room = useQuery(api.rooms.getBySimulation, { simulationId: typedId })
  const createRoom = useMutation(api.rooms.create)
  const generateReport = useAction(api.reports.generate)
  const initialized = useRef(false)
  const ended = useRef(false)

  const toggleMicRef = useRef<(() => void) | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const handleToggleMic = useCallback(() => toggleMicRef.current?.(), [])

  if (room === undefined || simulation === undefined) return null

  if (room === null) {
    if (!initialized.current) {
      initialized.current = true
      createRoom({ simulationId: typedId, characters: [DEFAULT_CHARACTERS[0]] })
    }
    return null
  }

  const character = room.characters[0]
  const handleEndSession = () => {
    if (ended.current) return
    ended.current = true
    router.push(`/simulation/${simulationId}/report`)
    generateReport({ roomId: room._id }).catch((err) =>
      console.error("report generation failed:", err)
    )
  }
  const handlePromptSelect = (_prompt: string) => {}

  return (
    <div
      data-surface="dark"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <RoomHeader
        simulationName={simulation?.title ?? ""}
        round="SESSION"
        startedAt={room._creationTime}
        onEndSession={handleEndSession}
      />
      <UserSpeechBridge roomId={room._id} enabled={isMicEnabled} />
      <div className="flex flex-1 gap-3 overflow-hidden p-4">
        <div className="flex w-[180px] shrink-0 flex-col gap-3">
          <UserTile
            userName="Founder"
            simulationName={simulation?.title ?? ""}
            isMicEnabled={isMicEnabled}
            onToggleMic={handleToggleMic}
          />
          <PromptHelpers onSelect={handlePromptSelect} />
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 min-w-0 overflow-hidden">
          <div className="relative flex-1 min-h-0 aspect-[1088/645] max-w-full overflow-hidden rounded-xl bg-[#1C1C1E]">
            {character?.avatarId ? (
              <AvatarProvider
                avatarId={character.avatarId}
                connectUrl="/api/avatar/connect"
                audio
                video={false}
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-medium text-white/60">{character.name}</p>
                      <p className="text-sm text-white/40">Connecting...</p>
                    </div>
                  </div>
                }
              >
                <TranscriptBridge roomId={room._id} character={character} />
                <MicBridge
                  onStateChange={setIsMicEnabled}
                  toggleRef={toggleMicRef}
                />
                <AvatarVideo className="absolute inset-0 h-full w-full object-cover" />
              </AvatarProvider>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-white/40">No avatar configured</p>
              </div>
            )}
          </div>
          <div className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-medium">{character?.name}</p>
              <p className="text-xs text-muted-foreground">{character?.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-[320px] shrink-0 flex-col gap-3">
          <div className="flex-1 min-h-0">
            <TranscriptPanel transcript={room.transcript} />
          </div>
          <div className="flex-1 min-h-0">
            <LiveNotes notes={room.liveNotes} startedAt={room._creationTime} />
          </div>
        </div>
      </div>
    </div>
  )
}
