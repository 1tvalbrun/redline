"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { AvatarProvider, AvatarVideo } from "@runwayml/avatars-react"
import { Mic, MicOff, Pause } from "lucide-react"
import { deriveReadiness, AXIS_LABELS } from "@/lib/readiness"
import { formatElapsed } from "@/lib/utils"
import { UserTile, type MicState } from "./UserTile"
import { PromptHelpers } from "./PromptHelpers"
import { TranscriptPanel } from "./TranscriptPanel"
import { LiveNotes } from "./LiveNotes"
import { TranscriptBridge } from "./TranscriptBridge"
import { MicBridge } from "./MicBridge"
import { UserSpeechBridge } from "./UserSpeechBridge"
import { SessionStatusBridge } from "./SessionStatusBridge"
import { Waveform, NAMEPLATE_WAVE_DELAYS } from "./Waveform"

type RoomShellProps = {
  simulationId: string
}

const SessionClock = ({ startedAt }: { startedAt: number }) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <span className="font-mono text-xs tracking-[.1em] tabular-nums text-white [text-shadow:0_1px_4px_rgba(0,0,0,.5)]">
      {formatElapsed(startedAt, now)}
    </span>
  )
}

export const RoomShell = ({ simulationId }: RoomShellProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"simulations">
  const room = useQuery(api.rooms.getBySimulation, { simulationId: typedId })
  const generateReport = useAction(api.reports.generate)
  const ended = useRef(false)

  const toggleMicRef = useRef<(() => void) | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [micError, setMicError] = useState<Error | null>(null)
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false)
  const [avatarError, setAvatarError] = useState<Error | null>(null)
  const [connectAttempt, setConnectAttempt] = useState(0)
  const handleToggleMic = useCallback(() => toggleMicRef.current?.(), [])

  // A room with no chosen panelist means the founder skipped the Panel
  // stage — send them there instead of defaulting one.
  useEffect(() => {
    if (room === null) {
      router.replace(`/simulation/${simulationId}/panel`)
    }
  }, [room, router, simulationId])

  if (room === undefined || room === null) return null

  const character = room.characters[0]
  const concluded = room.status === "concluded"
  const turns = room.transcript.length
  const underFire = deriveReadiness(room.riskScores).underFire

  const handleEndSession = () => {
    if (ended.current) return
    ended.current = true
    router.push(`/simulation/${simulationId}/report`)
    if (concluded) return
    generateReport({ roomId: room._id }).catch((err) =>
      console.error("report generation failed:", err)
    )
  }

  const handleRetryConnect = () => {
    setAvatarError(null)
    setConnectAttempt((n) => n + 1)
  }

  const micState: MicState = concluded
    ? "ended"
    : micError
      ? "blocked"
      : isMicEnabled
        ? "live"
        : "muted"
  const micLive = micState === "live"

  return (
    <div
      data-surface="dark"
      className="relative grid h-full min-h-0 grid-cols-[244px_1fr_336px] grid-rows-[1fr_auto] bg-surface text-on-surface"
    >
      <div aria-hidden="true" className="grain-overlay absolute inset-0 z-50 opacity-5" />
      {!concluded && <UserSpeechBridge roomId={room._id} enabled={micLive} />}

      <aside className="col-start-1 row-span-2 row-start-1 flex flex-col gap-[18px] border-r border-line bg-surface-raised px-4 py-5">
        <UserTile userName="Founder" micState={micState} onToggleMic={handleToggleMic} />
        <PromptHelpers className="mt-auto" />
      </aside>

      <main className="relative col-start-2 row-start-1 overflow-hidden bg-[#0e0c0a]">
        {concluded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              Session ended
            </p>
            <p className="max-w-[38ch] text-center text-[13.5px] text-on-surface-2">
              This run has concluded. Your report is on the verdict page.
            </p>
          </div>
        ) : !character?.avatarId ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              No avatar configured
            </p>
          </div>
        ) : avatarError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-red-fg">
              Connection failed
            </p>
            <p className="max-w-[40ch] text-center text-[13.5px] text-on-surface-2">
              {avatarError.message}
            </p>
            <button
              type="button"
              onClick={handleRetryConnect}
              className="focus-ring border border-line-2 px-4 py-[10px] font-mono text-[11px] uppercase tracking-[.08em] text-on-surface transition-colors hover:bg-white/5"
            >
              Reconnect
            </button>
          </div>
        ) : (
          <AvatarProvider
            key={connectAttempt}
            avatarId={character.avatarId}
            connectUrl="/api/avatar/connect"
            audio
            video={false}
            onError={setAvatarError}
            fallback={
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#c8c6be,#a6a49c_58%,#8f8d85)]">
                <div className="absolute inset-0 bg-[radial-gradient(62%_46%_at_50%_20%,rgba(255,255,255,.4),transparent_62%)]" />
                <p className="absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-[.14em] text-[#544f45]">
                  Connecting {character.name}…
                </p>
              </div>
            }
          >
            <TranscriptBridge roomId={room._id} character={character} />
            <MicBridge onStateChange={setIsMicEnabled} toggleRef={toggleMicRef} />
            <SessionStatusBridge
              onSpeakingChange={setIsAvatarSpeaking}
              onMicError={setMicError}
            />
            <AvatarVideo className="absolute inset-0 h-full w-full object-cover" />
          </AvatarProvider>
        )}

        <div
          aria-hidden="true"
          className="grain-overlay absolute inset-0 opacity-[.09]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_30px_rgba(0,0,0,.5)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[rgba(10,9,7,.82)] to-transparent"
        />

        <div className="absolute left-[18px] top-[18px] z-[5] flex items-center gap-[10px]">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.5)]">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full bg-red ${concluded ? "" : "animate-pulse-red"}`}
            />
            {concluded ? "Ended" : "Recording"}
          </span>
          {!concluded && <SessionClock startedAt={room._creationTime} />}
        </div>

        {character && (
          <div className="absolute bottom-[22px] left-6 z-[5]">
            <p className="font-display text-[30px] font-bold tracking-[-.01em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.4)]">
              {character.name}
            </p>
            <p className="mt-[5px] font-mono text-[11px] uppercase tracking-[.1em] text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
              {character.role}
            </p>
            {!concluded && (
              <div className="mt-[11px] flex items-center gap-2">
                <Waveform
                  active={isAvatarSpeaking}
                  delays={NAMEPLATE_WAVE_DELAYS}
                  barClassName="w-[3px] bg-red-fg"
                  className="h-4 gap-[3px]"
                />
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-white">
                  {isAvatarSpeaking ? "Speaking" : "Live"}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="col-start-2 row-start-2 flex items-center gap-4 border-t border-line bg-surface-2 px-[22px] py-[13px]">
        <button
          type="button"
          onClick={handleToggleMic}
          disabled={micState === "blocked" || micState === "ended"}
          aria-label={
            micState === "blocked"
              ? "Microphone blocked by browser permissions"
              : micLive
                ? "Mute microphone"
                : "Unmute microphone"
          }
          className={`focus-ring flex h-[42px] w-[42px] items-center justify-center rounded-full border transition-colors hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent ${
            micLive ? "border-ok-fg text-ok-fg" : "border-line-2 text-on-surface"
          }`}
        >
          {micLive ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
        </button>
        <button
          type="button"
          disabled
          aria-label="Pause session (not available in live sessions yet)"
          title="Pause is not available in live sessions yet"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-line-2 text-on-surface opacity-40"
        >
          <Pause className="h-[18px] w-[18px]" />
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2">
          <b className="font-semibold text-on-surface tabular-nums">{turns}</b> turns
          {underFire && ` · ${AXIS_LABELS[underFire]} under discussion`}
        </span>
        <button
          type="button"
          onClick={handleEndSession}
          className="focus-ring ml-auto flex items-center gap-[9px] border border-red bg-red px-5 py-[11px] font-mono text-[11px] uppercase tracking-[.08em] text-white transition-colors hover:bg-red-deep"
        >
          {concluded ? "View report" : "End session"} <span aria-hidden="true">→</span>
        </button>
      </div>

      <aside className="col-start-3 row-span-2 row-start-1 flex min-h-0 flex-col border-l border-line bg-surface-raised">
        <div className="min-h-0 flex-[1.25] border-b border-line">
          <TranscriptPanel transcript={room.transcript} startedAt={room._creationTime} />
        </div>
        <div className="min-h-0 flex-1">
          <LiveNotes notes={room.liveNotes} startedAt={room._creationTime} />
        </div>
      </aside>
    </div>
  )
}
