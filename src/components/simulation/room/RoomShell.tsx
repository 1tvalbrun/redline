"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useAction, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { AvatarProvider, AvatarVideo } from "@runwayml/avatars-react"
import { Mic, MicOff, Pause } from "lucide-react"
import { getPack } from "@/domains/registry"
import { isSessionStale, lastActivityAt } from "@/lib/session"
import { useNow } from "@/lib/useNow"
import { formatElapsed } from "@/lib/utils"
import { UserTile, type MicState } from "./UserTile"
import { PromptHelpers } from "./PromptHelpers"
import { Disclosure } from "@/components/shared/Disclosure"
import { TranscriptPanel } from "./TranscriptPanel"
import { LiveNotes } from "./LiveNotes"
import { TranscriptBridge } from "./TranscriptBridge"
import { MicBridge } from "./MicBridge"
import { UserSpeechBridge } from "./UserSpeechBridge"
import { SessionStatusBridge, type AvatarStatus } from "./SessionStatusBridge"
import { Waveform, NAMEPLATE_WAVE_DELAYS } from "./Waveform"

type RoomShellProps = {
  simulationId: string
}

// How long a connect attempt may sit without a live avatar before the room
// stops waiting and offers retry/exit. Covers the full path (session
// create ≤60s server-side is the outlier; a healthy connect is <15s).
const AVATAR_CONNECT_TIMEOUT_MS = 40_000

// Display-only hold on the user's finalized turns so both sides land at
// one rhythm: the avatar's transcript inherently lags several seconds behind
// its speech (measured ~8-10s in live sessions), the user's commits
// ~0.7s after theirs. The orchestrator is NOT delayed — decide reads
// Convex directly. Tune the cadence here.
const USER_TRANSCRIPT_DELAY_MS = 6000

// Elapsed for THIS sitting, anchored at mount — a resumed room is far older
// than the session being recorded (anchoring at session creation once read
// "22560:17"). A mid-session refresh restarts the readout; the transcript
// keeps the true times.
const SessionClock = () => {
  const [startedAt] = useState(() => Date.now())
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
  const typedId = simulationId as Id<"practices">
  const session = useQuery(api.sessions.getLive, { practiceId: typedId })
  const practice = useQuery(api.practices.get, { id: typedId })
  const generateDebrief = useAction(api.sessions.generateDebrief)
  const endSession = useMutation(api.sessions.end)
  const ended = useRef(false)

  const toggleMicRef = useRef<(() => void) | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [micError, setMicError] = useState<Error | null>(null)
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false)
  const [avatarError, setAvatarError] = useState<Error | null>(null)
  const [connectAttempt, setConnectAttempt] = useState(0)
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>("connecting")
  // True once this connect attempt produced a live avatar — used to tell a
  // failed connect ("closed before it connected") apart from a session
  // that died afterwards (GWM sessions end themselves; observed live).
  const [hasConnected, setHasConnected] = useState(false)
  // True once this attempt actually reported an in-flight connection. A
  // LiveKit room starts in Disconnected — which the SDK surfaces as
  // "ended" — so "ended" only means "closed before it connected" if the
  // attempt was seen connecting first (traced live: reading the initial
  // "ended" as failure unmounted the provider mid-connect, aborting every
  // re-entry with "Client initiated disconnect").
  const [attemptStarted, setAttemptStarted] = useState(false)
  // The SDK caches connect credentials per connectUrl forever, so a bare
  // URL makes re-entries and retries reconnect to the old (dead) Runway
  // session — the original "empty room" hang. A nonce per mount and per
  // retry forces a fresh session each time; the route ignores the query.
  const [mountNonce] = useState(() => Date.now())
  // Which connect attempt hit the deadline — comparing against the current
  // attempt makes each retry start with a clean slate, no reset needed.
  const [timedOutAttempt, setTimedOutAttempt] = useState<number | null>(null)
  const mountedAt = useNow()
  const handleToggleMic = useCallback(() => toggleMicRef.current?.(), [])

  const handleAvatarStatus = useCallback((status: AvatarStatus) => {
    setAvatarStatus(status)
    if (status === "connecting" || status === "waiting") setAttemptStarted(true)
    if (status === "ready") setHasConnected(true)
  }, [])

  // The session can hang without ever erroring (observed live: LiveKit
  // connects but the avatar worker never joins, so onError never fires).
  // A user must not be trapped staring at an empty room — after the
  // deadline the failure view offers retry or a graceful exit.
  useEffect(() => {
    const timer = setTimeout(
      () => setTimedOutAttempt(connectAttempt),
      AVATAR_CONNECT_TIMEOUT_MS
    )
    return () => clearTimeout(timer)
  }, [connectAttempt])

  const connectTimedOut = timedOutAttempt === connectAttempt

  // No live session for this practice means the user hasn't chosen a
  // panelist (or the session concluded) — send them to the meet step.
  // The end-session path guards with ended.current so its own navigation
  // isn't raced by this redirect.
  useEffect(() => {
    if (session === null && !ended.current) {
      router.replace(`/simulation/${simulationId}/panel`)
    }
  }, [session, router, simulationId])

  // Wait for the practice too: getPack falls back to the founder pack, so
  // rendering before packId arrives would flash founder labels in a sales room.
  if (session === undefined || session === null || practice === undefined) return null

  const pack = getPack(practice?.packId)
  const persona = session.persona
  // A live session left idle past the threshold reads as over: one
  // interrogation is one sitting. Judged against mount time so the state
  // can't flip mid-visit.
  const stale = isSessionStale(
    session.transcript.length,
    lastActivityAt(session.transcript, session._creationTime),
    mountedAt
  )
  const sessionOver = stale

  const handleEndSession = () => {
    if (ended.current) return
    ended.current = true
    // Conclude first so the session stops reading as live everywhere, then
    // generate; navigation doesn't wait on either.
    endSession({ id: session._id })
      .then(() => generateDebrief({ sessionId: session._id }))
      .catch((err) => console.error("end session failed:", err))
    router.push(`/p/${simulationId}/s/${session._id}`)
  }

  const handleRetryConnect = () => {
    setAvatarError(null)
    setHasConnected(false)
    setAttemptStarted(false)
    setAvatarStatus("connecting")
    setConnectAttempt((n) => n + 1)
  }

  // Everything that means "this attempt no longer has a live avatar": an
  // explicit error, a session that closed after starting to connect but
  // before becoming ready, a connected session that later died (the SDK has
  // no session-level reconnect — "ended" after connect is final), or the
  // deadline passing with no avatar. (The SDK never reports an "error"
  // status — errors arrive via onError.)
  const avatarFailure =
    sessionOver || avatarError
      ? avatarError?.message ?? null
      : hasConnected
        ? avatarStatus === "ended"
          ? `The live session ended on ${persona.name}'s side.`
          : null
        : attemptStarted && avatarStatus === "ended"
          ? "The avatar session closed before it connected."
          : connectTimedOut
            ? `No response after ${AVATAR_CONNECT_TIMEOUT_MS / 1000} seconds.`
            : null

  const micState: MicState = sessionOver
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
      {!sessionOver && <UserSpeechBridge sessionId={session._id} enabled={micLive} />}

      <aside className="col-start-1 row-span-2 row-start-1 flex flex-col gap-[18px] border-r border-line bg-surface-raised px-4 py-5">
        <UserTile userName={pack.userTitle} micState={micState} onToggleMic={handleToggleMic} />
        <PromptHelpers prompts={pack.copy.promptHelpers} className="mt-auto" />
        <Disclosure />
      </aside>

      <main className="relative col-start-2 row-start-1 overflow-hidden bg-[#0e0c0a]">
        {sessionOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              Session ended
            </p>
            <p className="max-w-[38ch] text-center text-[13.5px] text-on-surface-2">
              This session sat idle too long and has ended. Your debrief comes
              from what&apos;s on the record.
            </p>
          </div>
        ) : avatarFailure ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-red-fg">
              {persona.name} isn&apos;t responding
            </p>
            <p className="max-w-[42ch] text-center text-[13.5px] text-on-surface-2">
              {avatarFailure} Your session and everything said so far are
              safe. Retry the connection, or end now and get your debrief
              from what&apos;s on the record.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetryConnect}
                className="focus-ring border border-line-2 px-4 py-[10px] font-mono text-[11px] uppercase tracking-[.08em] text-on-surface transition-colors hover:bg-white/5"
              >
                Retry connection
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                className="focus-ring border border-red bg-red px-4 py-[10px] font-mono text-[11px] uppercase tracking-[.08em] text-white transition-colors hover:bg-red-deep"
              >
                End session · get the debrief <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : (
          <AvatarProvider
            key={connectAttempt}
            avatarId={persona.avatarId}
            connectUrl={`/api/avatar/connect?fresh=${mountNonce}-${connectAttempt}&sessionId=${session._id}`}
            audio
            video={false}
            onError={setAvatarError}
            fallback={
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#c8c6be,#a6a49c_58%,#8f8d85)]">
                <div className="absolute inset-0 bg-[radial-gradient(62%_46%_at_50%_20%,rgba(255,255,255,.4),transparent_62%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                  <p className="font-mono text-[11px] uppercase tracking-[.14em] text-[#544f45] motion-safe:animate-pulse">
                    Connecting {persona.name}…
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[#544f45]/70">
                    Establishing the live session (up to ~30 seconds)
                  </p>
                </div>
              </div>
            }
          >
            <TranscriptBridge sessionId={session._id} character={persona} />
            <MicBridge onStateChange={setIsMicEnabled} toggleRef={toggleMicRef} />
            <SessionStatusBridge
              onSpeakingChange={setIsAvatarSpeaking}
              onMicError={setMicError}
              onAvatarStatus={handleAvatarStatus}
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
              className={`h-2 w-2 rounded-full bg-red ${sessionOver ? "" : "animate-pulse-red"}`}
            />
            {sessionOver ? "Ended" : "Recording"}
          </span>
          {!sessionOver && <SessionClock />}
        </div>

        {!avatarFailure && (
          <div className="absolute bottom-[22px] left-6 z-[5]">
            <p className="font-display text-[30px] font-bold tracking-[-.01em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.4)]">
              {persona.name}
            </p>
            <p className="mt-[5px] font-mono text-[11px] uppercase tracking-[.1em] text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
              {persona.role}
            </p>
            {!sessionOver && (
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
        {session.currentTopic && (
          <span className="font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2">
            {session.currentTopic} under discussion
          </span>
        )}
        <button
          type="button"
          onClick={handleEndSession}
          className="focus-ring ml-auto flex items-center gap-[9px] border border-red bg-red px-5 py-[11px] font-mono text-[11px] uppercase tracking-[.08em] text-white transition-colors hover:bg-red-deep"
        >
          {stale ? "Get the debrief" : "End session"} <span aria-hidden="true">→</span>
        </button>
      </div>

      <aside className="col-start-3 row-span-2 row-start-1 flex min-h-0 flex-col border-l border-line bg-surface-raised">
        <div className="min-h-0 flex-[1.25] border-b border-line">
          <TranscriptPanel
            transcript={session.transcript}
            startedAt={session._creationTime}
            delayUserMs={sessionOver ? undefined : USER_TRANSCRIPT_DELAY_MS}
          />
        </div>
        <div className="min-h-0 flex-1">
          <LiveNotes notes={session.liveNotes} startedAt={session._creationTime} />
        </div>
      </aside>
    </div>
  )
}
