"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useAction, useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { Doc, Id } from "@convex/_generated/dataModel"
import { AvatarProvider, AvatarVideo } from "@runwayml/avatars-react"
import { Check, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { firstNameOf, initialsOf } from "@/domains/types"
import { getPack } from "@/domains/registry"
import { idleState } from "@/lib/idleRule"
import {
  pickInvitation,
  roomTimePhase,
  shouldInvite,
  shouldLandAfterClose,
  ROOM_MS,
} from "@/lib/roomClock"
import { markRoomLanding } from "@/lib/roomLanding"
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
  // Fired once when the room settles, so the page can fade the flow header
  // it does not render (the whole room goes quiet, per the approved mock).
  onSettled: () => void
}

// How long a connect attempt may sit without a live avatar before the room
// stops waiting and offers retry/exit. The connect route polls Runway for up
// to 60s and answers its deadline with a distinct code (queued/timeout), so
// the client has to outwait the route — give up sooner and those answers
// arrive to nobody, and the room shows a generic stall instead of the truth.
const AVATAR_CONNECT_TIMEOUT_MS = 70_000

// Display-only hold on the user's finalized turns so both sides land at
// one rhythm: the avatar's transcript inherently lags several seconds behind
// its speech (measured ~8-10s in live sessions), the user's commits
// ~0.7s after theirs. The orchestrator is NOT delayed — decide reads
// Convex directly. Tune the cadence here.
const USER_TRANSCRIPT_DELAY_MS = 6000

// Wait for trailing transcription finals before generating the debrief so
// the user's last words make the record. Measured in the clock spike.
const TRANSCRIPT_TAIL_MS = 3_000

// Floor on the settle scene, so the beat reads even when generation is instant.
const SETTLE_MIN_MS = 2_500

// Ceiling on the settle: past this the room navigates regardless, and the
// report page's deliberation block owns the wait and the retry.
const SETTLE_MAX_MS = 30_000

// When the settle's second line stops promising a quick landing. Sits just
// under the navigation cap on purpose: a typical debrief takes longer than
// the old threshold, so the soften showed on nearly every landing and read
// as something being wrong. Now it appears only in the genuinely slow tail.
const SETTLE_SOFTEN_MS = 22_000

// The settle's deliberation steps (approved mock): the first two tick
// through on a fixed rhythm and the last holds until the debrief is ready,
// so a longer wait reads as writing, never as a stall.
const SETTLE_STEPS = [
  "Rereading the record",
  "Weighing what held and what didn't",
  "Writing the close",
] as const
const SETTLE_STEP_TIMES_MS = [2_800, 4_700] as const

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const CONNECT_CODE_VALUES = ["unavailable", "cap", "complete", "queued", "timeout", "failed"] as const

type ConnectCode = (typeof CONNECT_CODE_VALUES)[number]

const CONNECT_CODES: ReadonlySet<string> = new Set(CONNECT_CODE_VALUES)

// Codes a retry can never clear: the connect cap is spent, or the
// session's time is up. Gates both the failure view's Retry button and the
// silent first-attempt retry.
const TERMINAL_CONNECT_CODES: ReadonlySet<string> = new Set([
  "cap",
  "complete",
] satisfies ConnectCode[])

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

type RoomShellBodyProps = {
  session: Doc<"sessions">
  // Null only if the practice vanished under a live session; the room still
  // renders (getPack falls back) rather than stranding the user. Typed off
  // the query: the server strips the blueprint's sealed fields.
  practice: FunctionReturnType<typeof api.practices.get>
  simulationId: string
  // Shared with RoomShell: one latch for "this client is on its way out",
  // so the parent's redirect can't race the landing's own navigation.
  endedRef: RefObject<boolean>
  // Called once, at the start of the landing: tells the parent to hold this
  // session on screen after getLive stops returning it (see RoomShell).
  onLanding: () => void
  // Called when the room settles, so chrome outside this component (the
  // flow header) fades with the room's own.
  onSettled: () => void
}

// Everything below the session/practice narrowing. Its own component so the
// landing hooks (clock tick, phase effects, Convex calls) run unconditionally
// — they can't sit after the parent's early returns.
const RoomShellBody = ({
  session,
  practice,
  simulationId,
  endedRef,
  onLanding,
  onSettled,
}: RoomShellBodyProps) => {
  const router = useRouter()
  const generateDebrief = useAction(api.sessions.generateDebrief)
  const endSession = useMutation(api.sessions.end)

  const toggleMicRef = useRef<(() => void) | null>(null)
  // The Runway session this attempt minted, held only while it has yet to
  // produce a live avatar. A session nobody joins keeps running: it bills,
  // and it holds the org's single concurrency slot, which makes every retry
  // queue behind it. Cleared the moment the avatar is ready — a live session
  // is never abandoned.
  const pendingRunwaySessionRef = useRef<string | null>(null)
  // The in-flight connect request. The route holds it open for up to a
  // minute; a retry or an unmount must cancel it, or its late success lands
  // in a room that moved on — observed on mobile as an orphaned Runway
  // session holding the org's single concurrency slot, queueing every retry.
  const connectAbortRef = useRef<AbortController | null>(null)
  // Last moment the transcription stream heard the user at all — interims
  // included, long before a final commits. Feeds the idle rule only; a ref
  // because it changes on every spoken word and must not cause renders.
  const lastHeardAtRef = useRef<number | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [micError, setMicError] = useState<Error | null>(null)
  const [transcriptionFailed, setTranscriptionFailed] = useState(false)
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
  // Identifies this tab to the connect claim; the latest claim wins the room
  // and older tabs yield (session.roomClientId mismatch).
  const [clientId] = useState(() => crypto.randomUUID())
  // Which connect attempt hit the deadline — comparing against the current
  // attempt makes each retry start with a clean slate, no reset needed.
  const [timedOutAttempt, setTimedOutAttempt] = useState<number | null>(null)
  // Ticks so the room's phase advances on the wall clock, not on renders
  // that happen to arrive. All landing math derives from it in render.
  const [now, setNow] = useState(() => Date.now())
  const [landing, setLanding] = useState(false)
  // Below lg the transcript column doesn't exist; this opens it as a sheet
  // over the stage instead.
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  // The settle: the wrap chrome has passed, the conversation is over, and the
  // room holds a quiet deliberation scene until the debrief exists. Always
  // set with (or after) landing — every gate keyed on landing still holds.
  const [settled, setSettled] = useState(false)
  const [settleSoftened, setSettleSoftened] = useState(false)
  // Index of the active deliberation step; steps before it render as done.
  const [settleStep, setSettleStep] = useState(0)
  const mountedAt = useNow()

  const handleToggleMic = useCallback(() => toggleMicRef.current?.(), [])

  const handleTranscriptionFailedChange = useCallback(
    (failed: boolean) => setTranscriptionFailed(failed),
    []
  )

  const handleUserHeard = useCallback(() => {
    lastHeardAtRef.current = Date.now()
  }, [])

  const handleAvatarStatus = useCallback((status: AvatarStatus) => {
    setAvatarStatus(status)
    if (status === "connecting" || status === "waiting") setAttemptStarted(true)
    if (status === "ready") {
      pendingRunwaySessionRef.current = null
      setHasConnected(true)
    }
  }, [])

  // Fire and forget: releases a Runway session that never produced an avatar.
  // A failed release is not worth telling the user about, and the room is
  // usually navigating away as this runs. Both ids go up: the route deletes
  // only when the owned Convex session's stored runwaySessionId matches.
  const abandonPendingSession = useCallback(() => {
    const id = pendingRunwaySessionRef.current
    if (!id) return
    pendingRunwaySessionRef.current = null
    fetch("/api/avatar/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session._id, runwaySessionId: id }),
    }).catch(() => {})
  }, [session._id])

  // The room ends itself: conclude, hold for the transcription tail so the
  // user's last words make the record, then settle the room while the
  // debrief is written and land on it once it exists (min hold so the beat
  // reads, capped so a dead generation can't strand anyone — the report
  // page owns retries). The latch makes this a one-way door. onLanding
  // fires first: the conclusion below drops this session out of getLive
  // within a round trip, and the parent must be holding it before that
  // lands or this component (avatar session and transcript bridge included)
  // unmounts mid-landing.
  const handleLand = useCallback(
    (reason: "time" | "idle" | "verdict") => {
      if (endedRef.current) return
      endedRef.current = true
      onLanding()
      setLanding(true)
      const landed = endSession({ id: session._id, reason })
        .then(() => wait(TRANSCRIPT_TAIL_MS))
        .then(() => {
          setSettled(true)
          onSettled()
          const generation = generateDebrief({ sessionId: session._id }).catch((err) =>
            console.error("debrief generation failed:", err)
          )
          return Promise.race([
            Promise.all([generation, wait(SETTLE_MIN_MS)]),
            wait(SETTLE_MAX_MS),
          ])
        })
        .catch((err) => console.error("landing failed:", err))
      // The outer race is the only navigation guarantee: an offline Convex
      // mutation retries forever instead of rejecting, and a promise that
      // never settles would strand the room at "Wrapping up".
      Promise.race([landed, wait(TRANSCRIPT_TAIL_MS + SETTLE_MAX_MS)]).then(() => {
        markRoomLanding()
        router.push(`/p/${simulationId}/s/${session._id}`)
      })
    },
    [endedRef, onLanding, onSettled, endSession, generateDebrief, router, session._id, simulationId]
  )

  // The settle's honesty budget: past SETTLE_SOFTEN_MS the second line
  // softens, matching the report page's deliberation block.
  useEffect(() => {
    if (!settled) return
    const timer = setTimeout(() => setSettleSoftened(true), SETTLE_SOFTEN_MS)
    return () => clearTimeout(timer)
  }, [settled])

  // Ticks the deliberation steps through their rhythm once the settle is on
  // screen; the last step holds until navigation.
  useEffect(() => {
    if (!settled) return
    const timers = SETTLE_STEP_TIMES_MS.map((ms, i) =>
      setTimeout(() => setSettleStep(i + 1), ms)
    )
    return () => timers.forEach(clearTimeout)
  }, [settled])

  // Anchors the room's time phase and the idle rule below.
  const roomStartedAt = session.roomStartedAt

  const connectTimedOut = timedOutAttempt === connectAttempt

  // Whatever Runway minted is a ghost the moment this attempt is over without
  // an avatar: the deadline passing, or an error arriving well before it. The
  // ref makes a double fire a no-op, so both triggers can be blunt.
  useEffect(() => {
    if (hasConnected) return
    if (!connectTimedOut && avatarError === null) return
    abandonPendingSession()
  }, [connectTimedOut, avatarError, hasConnected, abandonPendingSession])

  // Leaving mid-connect (a navigation, a refresh) must not strand the session
  // this room minted. abandonPendingSession is stable, so this runs only on
  // unmount, and only ever finds an id when no avatar arrived.
  useEffect(() => () => abandonPendingSession(), [abandonPendingSession])

  const phase = roomStartedAt ? roomTimePhase(roomStartedAt, now) : "open"
  const invitation =
    roomStartedAt && shouldInvite(roomStartedAt, now) && !isAvatarSpeaking
      ? pickInvitation(session._creationTime, firstNameOf(session.persona.name))
      : null

  const pack = getPack(practice?.packId)
  const persona = session.persona
  // A live session left idle past the threshold reads as over: one
  // interrogation is one sitting. Judged against mount time so the state
  // can't flip mid-visit.
  const sessionOver = isSessionStale(
    session.transcript.length,
    lastActivityAt(session.transcript, session._creationTime),
    mountedAt
  )

  // Another tab claimed the room after this one connected: yield instead of
  // competing for the same avatar session (latest claim wins, by design).
  const takenOver =
    hasConnected && session.roomClientId !== undefined && session.roomClientId !== clientId

  // The SDK's connectUrl mode hides the response body, so refusals all look
  // alike. A custom connect surfaces the route's code as the Error message,
  // which avatarFailure maps to honest copy (a capped session must not
  // offer a Retry that can never succeed).
  // useCallback, not a plain function: the SDK's connect hook (useCredentials)
  // includes this prop's identity in its own dependency array, so an unstable
  // identity re-runs its connection logic every render against credentials
  // that consume exactly once — observed live as "already connected" spam in
  // LiveKit logs and avatar sessions that never joined.
  const handleConnect = useCallback(
    async (avatarId: string) => {
      connectAbortRef.current?.abort()
      const controller = new AbortController()
      connectAbortRef.current = controller
      const res = await fetch(
        `/api/avatar/connect?sessionId=${session._id}&clientId=${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarId }),
          signal: controller.signal,
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.code ?? "unavailable")
      pendingRunwaySessionRef.current = data?.sessionId ?? null
      return data
    },
    [session._id, clientId]
  )

  // The abort must also fire when the whole room unmounts mid-connect (a
  // navigation, a refresh) — otherwise the request outlives its room.
  useEffect(() => () => connectAbortRef.current?.abort(), [])

  const handleRetryConnect = useCallback(() => {
    connectAbortRef.current?.abort()
    abandonPendingSession()
    setAvatarError(null)
    setHasConnected(false)
    setAttemptStarted(false)
    setAvatarStatus("connecting")
    setConnectAttempt((n) => n + 1)
  }, [abandonPendingSession])

  // A first attempt that dies retryably gets one silent retry before any
  // failure view — observed live: first mints fail against a cold or
  // still-held Runway slot, while a fresh attempt reliably lands (retry
  // abandons the stuck session, mint sweeps the rest). A second failure is
  // shown honestly.
  const trySilentRetry = useCallback(() => {
    if (connectAttempt !== 0 || hasConnected || sessionOver) return false
    handleRetryConnect()
    return true
  }, [connectAttempt, hasConnected, sessionOver, handleRetryConnect])

  // An aborted connect is this room cancelling itself — never a failure to
  // show the user. Everything else is the attempt's truth.
  const handleAvatarError = useCallback(
    (err: Error) => {
      if (err.name === "AbortError") return
      if (!TERMINAL_CONNECT_CODES.has(err.message) && trySilentRetry()) return
      setAvatarError(err)
    },
    [trySilentRetry]
  )

  // The session can hang without ever erroring (observed live: LiveKit
  // connects but the avatar worker never joins, so onError never fires).
  // A user must not be trapped staring at an empty room — after the
  // deadline the failure view offers retry or a graceful exit.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (trySilentRetry()) return
      setTimedOutAttempt(connectAttempt)
    }, AVATAR_CONNECT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [connectAttempt, trySilentRetry])

  const handleEndSession = () => {
    if (endedRef.current) return
    endedRef.current = true
    // The user chose to leave: no transcription tail, the settle begins now.
    // Conclude first so the session stops reading as live everywhere, then
    // generate; navigation waits for the debrief (same min hold and cap as
    // handleLand) so the report is there when the room lets go.
    onLanding()
    setLanding(true)
    setSettled(true)
    onSettled()
    const generation = endSession({ id: session._id, reason: "user" })
      .then(() => generateDebrief({ sessionId: session._id }))
      .catch((err) => console.error("end session failed:", err))
    Promise.race([Promise.all([generation, wait(SETTLE_MIN_MS)]), wait(SETTLE_MAX_MS)]).then(
      () => {
        markRoomLanding()
        router.push(`/p/${simulationId}/s/${session._id}`)
      }
    )
  }

  // Nothing was said in this room, so there is nothing to debrief: end it as
  // an error and take the user back to the practice, no generation at all.
  const handleLeaveEmptyRoom = () => {
    if (endedRef.current) return
    endedRef.current = true
    abandonPendingSession()
    endSession({ id: session._id, reason: "error" }).catch((err) =>
      console.error("leave empty room failed:", err)
    )
    router.push(`/p/${simulationId}`)
  }

  // Everything that means "this attempt no longer has a live avatar": an
  // explicit error, a session that closed after starting to connect but
  // before becoming ready, a connected session that later died (the SDK has
  // no session-level reconnect — "ended" after connect is final), or the
  // deadline passing with no avatar. (The SDK never reports an "error"
  // status — errors arrive via onError.)
  // A landing room is over by choice: ending it releases the Runway session
  // server-side, and the "ended" that comes back must not read as failure.
  const avatarFailure = landing
    ? null
    : sessionOver || avatarError
      ? avatarError?.message ?? null
      : hasConnected
        ? avatarStatus === "ended"
          ? `The live session ended on ${persona.name}'s side.`
          : null
        : attemptStarted && avatarStatus === "ended"
          ? "The avatar session closed before it connected."
          : connectTimedOut
            ? "No response after more than a minute."
            : null

  const connectCode: ConnectCode | null =
    avatarError && CONNECT_CODES.has(avatarError.message)
      ? (avatarError.message as ConnectCode)
      : null
  const retryImpossible = connectCode !== null && TERMINAL_CONNECT_CODES.has(connectCode)

  // There is nothing to debrief and nothing to promise the user about a
  // record that can't produce one. Mirrors generateDebrief's guard exactly:
  // a debrief needs both sides on the record, so a session where only the
  // avatar spoke (opening delivered, died before the user's first final
  // committed) must not promise "your debrief comes from what's on the
  // record" — the guard would refuse it. The failure view offers the
  // practice instead.
  const nothingOnRecord =
    session.transcript.every((e) => e.type !== "user") ||
    session.transcript.every((e) => e.type !== "panelist")
  // "Couldn't join" is a stronger claim than "nothing to debrief": an avatar
  // that spoke its opening and then died DID join, so that headline is
  // reserved for a genuinely empty record.
  const neverJoined = session.transcript.length === 0

  // A room that failed with nothing on record must never land itself: the
  // debrief it would navigate to can't exist (generateDebrief refuses an
  // empty record), and the clock it would land on may have been burned by
  // failed connect attempts. The failure view's own buttons are the exits.
  const failedEmptyRoom = avatarFailure !== null && nothingOnRecord

  const failureHeadline =
    connectCode === "queued"
      ? "All panelists are in session"
      : neverJoined && connectCode !== "cap" && connectCode !== "complete"
        ? `${persona.name} couldn't join the room`
        : `${persona.name} isn't responding`

  const nothingCounts = "Nothing is lost and nothing counts against you."

  const failureBody =
    connectCode === "queued"
      ? nothingOnRecord
        ? `${firstNameOf(persona.name)} is finishing another session. You're next: retry in a moment, or head back to your practice.`
        : `${firstNameOf(persona.name)} is finishing another session. You're next: retry in a moment, or end now and get your debrief from what's on the record.`
      : connectCode === "cap"
        ? nothingOnRecord
          ? `This session has reached its connection limit. ${nothingCounts}`
          : "This session has reached its connection limit. Your conversation is safe; your debrief comes from what's on the record."
        : connectCode === "complete"
          ? nothingOnRecord
            ? `This session's time is up. ${nothingCounts}`
            : "This session's time is up. Your debrief is ready to be written."
          : nothingOnRecord
            ? `${nothingCounts} Retry the connection, or come back in a moment.`
            : `${connectCode ? "The connection didn't go through." : avatarFailure} Your session and everything said so far are safe. Retry the connection, or end now and get your debrief from what's on the record.`

  // Landing counts as ended: the mic bridge is already unmounted, so
  // isMicEnabled is a frozen last reading, not the truth.
  const micState: MicState =
    sessionOver || landing
      ? "ended"
      : micError
        ? "blocked"
        : isMicEnabled
          ? "live"
          : "muted"
  const micLive = micState === "live"

  // Dead air burns money with no ending at all (spec: Care Rules). Suspended
  // whenever the silence can't be attributed to the user: muted or blocked
  // mic, transcription failing while the mic is live, the persona
  // mid-speech, this attempt hasn't had a live avatar yet, the avatar it
  // had has since failed — silence in a failed room is not attributable to
  // the user; the failure view's explicit buttons are the exit, not an idle
  // timeout — or another tab owns the room: a yielded tab's mic is
  // unmounted, so it hears nothing and must never idle-end the session the
  // active tab is speaking in.
  const idleSuspended =
    micState !== "live" ||
    transcriptionFailed ||
    isAvatarSpeaking ||
    landing ||
    roomStartedAt === undefined ||
    !hasConnected ||
    avatarFailure !== null ||
    takenOver
  // Activity is measured from the microphone, not just the record: committed
  // turns lag live speech by seconds (finals commit after a pause; the
  // avatar's transcript arrives late), and at the top of a session that gap
  // spans the whole idle window — observed live as a "still there?" prompt
  // at under a minute while the user was mid-answer with zero turns landed.
  // Ref access keeps this out of render (react-hooks/refs): the tick below
  // owns the idle computation and mirrors the prompt into state.
  const roomActivityAt = useCallback(
    () =>
      Math.max(
        lastActivityAt(session.transcript, roomStartedAt ?? session._creationTime),
        lastHeardAtRef.current ?? 0
      ),
    [session.transcript, roomStartedAt, session._creationTime]
  )
  const [idlePrompt, setIdlePrompt] = useState(false)

  // The wall clock is the external system this room synchronizes with. One
  // tick does four jobs: advance `now` so the rendered phase and idle state
  // move, land the room the moment the clock runs out, land it if the room
  // has sat idle too long, and land it once a delivered close has had its
  // goodbye grace. Absolute timestamps, so a throttled
  // background tab still lands at the right wall-clock moment. The idle-end
  // check hits the same react-hooks/set-state-in-effect rule the time check
  // does, so it recomputes fresh (not from the render-derived `idle`) inside
  // this same subscription callback rather than its own effect.
  useEffect(() => {
    const tick = setInterval(() => {
      const at = Date.now()
      setNow(at)
      if (roomStartedAt !== undefined && !failedEmptyRoom) {
        const reached = roomTimePhase(roomStartedAt, at)
        // The persona's close is never cut by our clock except at the floor.
        const atFloor = at - roomStartedAt >= ROOM_MS - 2_000
        if ((reached === "resolving" || reached === "over") && (!isAvatarSpeaking || atFloor)) {
          handleLand("time")
        }
      }
      // A delivered close ends the session it belongs to: dead air past the
      // closing read is paid time spent on prompted brush-offs (observed
      // live as a minute of silence into the clock).
      if (!failedEmptyRoom && shouldLandAfterClose(session.closeDeliveredAt, at, isAvatarSpeaking)) {
        handleLand("verdict")
      }
      const idle = idleState(roomActivityAt(), at, idleSuspended)
      setIdlePrompt(idle === "prompt")
      if (idle === "end") handleLand("idle")
    }, 1000)
    return () => clearInterval(tick)
  }, [
    roomStartedAt,
    handleLand,
    idleSuspended,
    isAvatarSpeaking,
    roomActivityAt,
    session.closeDeliveredAt,
    failedEmptyRoom,
  ])

  return (
    // Below lg the 580px of fixed side tracks can't exist: the room stacks —
    // stage, self-view strip, control bar — and the transcript moves behind
    // the bar's toggle.
    <div
      data-surface="dark"
      className="relative grid h-full min-h-0 grid-cols-[244px_1fr_336px] grid-rows-[1fr_auto] bg-surface text-on-surface max-lg:flex max-lg:flex-col max-lg:overflow-hidden"
    >
      <div aria-hidden="true" className="grain-overlay absolute inset-0 z-50 opacity-5" />
      {/* Recording a room with no interviewer present is a privacy problem
          and produced garbage transcripts (observed live: a TV recorded for
          a full session) — the mic captures only while a live avatar is
          present this attempt (connected, not failed, not landing, not
          over). hasConnected alone is a one-way latch: an avatar that
          disconnects mid-session still reads as "connected", so avatarFailure
          (the room's single "no live avatar right now" signal) is required
          too. */}
      {!sessionOver && !landing && hasConnected && !avatarFailure && (
        <UserSpeechBridge
          sessionId={session._id}
          enabled={micLive && !takenOver}
          onFailureChange={handleTranscriptionFailedChange}
          onHeard={handleUserHeard}
        />
      )}

      <aside
        className={`col-start-1 row-span-2 row-start-1 flex flex-col gap-[18px] border-r border-line bg-surface-raised px-4 py-5 transition-opacity duration-700 motion-reduce:transition-none max-lg:order-2 max-lg:max-h-[26dvh] max-lg:flex-none max-lg:flex-row max-lg:items-stretch max-lg:gap-3 max-lg:border-r-0 max-lg:border-t max-lg:px-3 max-lg:py-2.5 ${settled ? "pointer-events-none opacity-0" : ""}`}
      >
        <UserTile
          userName={pack.userTitle}
          micState={micState}
          onToggleMic={handleToggleMic}
          className="max-lg:w-[136px] max-lg:flex-none"
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[18px] max-lg:gap-1.5">
          <PromptHelpers
            prompts={pack.copy.promptHelpers}
            className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto"
          />
          <Disclosure className="mt-auto max-lg:mt-0" />
        </div>
      </aside>

      <main className="relative col-start-2 row-start-1 overflow-hidden bg-[#0e0c0a] max-lg:order-1 max-lg:min-h-0 max-lg:flex-1">
        {/* The settle: the conversation is over, so the avatar subtree
            unmounts (no stray audio under the scene) and the room's dark
            ground holds a quiet deliberation line until the debrief exists
            and the landing navigates. First branch on purpose — the settle
            outranks every other state once the room is on its way out. */}
        {settled ? (
          <div className="absolute inset-0 animate-fade-in bg-[linear-gradient(180deg,#15120f,#0e0c0a_60%)] motion-reduce:animate-none">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-[18px] flex h-16 w-16 items-center justify-center rounded-full border border-[#38434f] bg-[linear-gradient(145deg,#2a3542,#1a212a)] text-[19px] font-semibold text-[#cdd6e0]">
                {initialsOf(persona.name)}
                <span
                  aria-hidden="true"
                  className="absolute -inset-[7px] rounded-full border border-accent-blue/35 motion-safe:animate-pulse"
                />
              </div>
              <p className="text-[16px] font-medium text-on-surface">
                {firstNameOf(persona.name)} is writing up your debrief.
              </p>
              <p className="mt-2 text-[13px] text-on-surface-3">
                {settleSoftened ? "Taking a bit longer than usual." : "Nothing else for you to do here."}
              </p>
              <div className="mt-8 flex min-w-[250px] flex-col gap-[11px]">
                {SETTLE_STEPS.map((label, i) => {
                  const state = i < settleStep ? "done" : i === settleStep ? "active" : "upcoming"
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-[11px] text-[12.5px] transition-opacity duration-500 motion-reduce:transition-none ${
                        state === "upcoming"
                          ? "text-on-surface-3 opacity-40"
                          : state === "active"
                            ? "text-on-surface-2 opacity-100"
                            : "text-on-surface-3 opacity-80"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border ${
                          state === "upcoming" ? "border-line" : "border-accent-blue/50"
                        }`}
                      >
                        {state === "active" && (
                          <span className="h-[5px] w-[5px] rounded-full bg-accent-blue motion-safe:animate-pulse" />
                        )}
                        {state === "done" && <Check className="size-[9px] text-accent-blue" />}
                      </span>
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : takenOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 max-lg:px-5">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              Open in another window
            </p>
            <p className="max-w-[38ch] text-center text-[13.5px] text-on-surface-2">
              This session is live in another window. You can keep watching
              the transcript here, or end and get the debrief.
            </p>
          </div>
        ) : sessionOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 max-lg:px-5">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
              Session ended
            </p>
            <p className="max-w-[38ch] text-center text-[13.5px] text-on-surface-2">
              This session sat idle too long and has ended. Your debrief comes
              from what&apos;s on the record.
            </p>
          </div>
        ) : avatarFailure ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 max-lg:px-5">
            <p className="text-center font-mono text-[11px] uppercase tracking-[.14em] text-red-fg">
              {failureHeadline}
            </p>
            <p className="max-w-[42ch] text-center text-[13.5px] text-on-surface-2">
              {failureBody}
            </p>
            <div className="flex items-center gap-3 max-lg:flex-wrap max-lg:justify-center">
              {!retryImpossible && (
                <button
                  type="button"
                  onClick={handleRetryConnect}
                  className="focus-ring rounded-[10px] border border-line-2 px-4 py-2.5 text-[13.5px] font-medium text-on-surface transition-colors hover:bg-white/5"
                >
                  Retry connection
                </button>
              )}
              <button
                type="button"
                onClick={nothingOnRecord ? handleLeaveEmptyRoom : handleEndSession}
                className="focus-ring rounded-[10px] bg-red px-4 py-2.5 text-[13.5px] font-medium text-white shadow-btn transition-colors hover:bg-red-deep"
              >
                {nothingOnRecord ? "Back to practice" : "End session, get the debrief"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : (
          <AvatarProvider
            key={connectAttempt}
            avatarId={persona.avatarId}
            connect={handleConnect}
            // The SDK caches credentials by (avatarId, sessionId, sessionKey,
            // connectUrl, baseUrl) and never invalidates (findings doc §1) —
            // the connect callback is NOT in the key. Without a per-attempt
            // component in the key, a second session with the same persona in
            // one page lifetime silently reuses the first session's
            // credentials: connect is never called, no avatar is minted, and
            // the room joins the previous, dead LiveKit room (observed live,
            // 2026-08-28). connectUrl is inert while `connect` is set
            // (fetchCredentials prefers connect), so it serves purely as the
            // cache key's freshness — the same guard the original connectUrl
            // nonce provided before the custom-connect refactor dropped it.
            connectUrl={`/api/avatar/connect?cacheKey=${session._id}-${connectAttempt}`}
            audio
            video={false}
            onError={handleAvatarError}
            fallback={
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#c8c6be,#a6a49c_58%,#8f8d85)]">
                <div className="absolute inset-0 bg-[radial-gradient(62%_46%_at_50%_20%,rgba(255,255,255,.4),transparent_62%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 max-lg:px-6 max-lg:text-center">
                  <p className="font-mono text-[11px] uppercase tracking-[.14em] text-[#544f45] motion-safe:animate-pulse">
                    Connecting {persona.name}…
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[#544f45]/70">
                    Establishing the live session (can take up to a minute)
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[#544f45]/50">
                    {`Sessions run five minutes. ${firstNameOf(persona.name)} will call time near the end.`}
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

        <div
          className={`absolute left-[18px] top-[18px] z-[5] flex items-center gap-[10px] transition-opacity duration-700 motion-reduce:transition-none ${settled ? "opacity-0" : ""}`}
        >
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.5)]">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full bg-red ${sessionOver || landing ? "" : "animate-pulse-red"}`}
            />
            {sessionOver ? "Ended" : landing ? "Wrapping up" : "Recording"}
          </span>
          {!sessionOver && !landing && <SessionClock />}
        </div>

        {invitation && !landing && (
          <div className="absolute bottom-[110px] left-6 z-[5] max-lg:bottom-[124px] max-lg:left-4">
            <p className="max-w-[34ch] font-mono text-[11px] uppercase tracking-[.12em] text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,.5)] motion-safe:animate-pulse">
              {invitation}
            </p>
          </div>
        )}

        {idlePrompt && !landing && (
          <div className="absolute left-1/2 top-[18px] z-[5] -translate-x-1/2 rounded-[10px] border border-line-2 bg-black/60 px-4 py-2 max-lg:top-12 max-lg:w-[calc(100%-32px)]">
            <p className="font-mono text-[11px] uppercase tracking-[.12em] text-white/85">
              Still there? The session wraps up shortly if the room stays quiet.
            </p>
          </div>
        )}

        {(micState === "muted" || micState === "blocked" || (micLive && transcriptionFailed)) &&
          !landing &&
          !sessionOver && (
            <div className="absolute left-1/2 top-[18px] z-[5] -translate-x-1/2 rounded-[10px] border border-line-2 bg-black/60 px-4 py-2 max-lg:top-12 max-lg:w-[calc(100%-32px)]">
              <p className="font-mono text-[11px] uppercase tracking-[.12em] text-white/85">
                {micState === "blocked"
                  ? `We can't reach your microphone. ${firstNameOf(persona.name)} can't hear you.`
                  : micState === "muted"
                    ? `Your microphone is muted. ${firstNameOf(persona.name)} can't hear you.`
                    : `We're having trouble hearing you. ${firstNameOf(persona.name)} may not catch everything.`}
              </p>
            </div>
          )}

        {!avatarFailure && (
          <div
            className={`absolute bottom-[22px] left-6 z-[5] transition-opacity duration-700 motion-reduce:transition-none max-lg:bottom-4 max-lg:left-4 ${settled ? "opacity-0" : ""}`}
          >
            <p className="font-display text-[30px] font-bold tracking-[-.01em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.4)] max-lg:text-[21px]">
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

      {/* min-h pins the bar at its tallest content (the End session button),
          so swapping the button for the landing text never resizes the video
          area above — observed live as the room "growing" at the wrap. */}
      <div
        className={`col-start-2 row-start-2 flex min-h-[67px] items-center gap-4 border-t border-line bg-surface-2 px-[22px] py-[13px] transition-opacity duration-700 motion-reduce:transition-none max-lg:order-3 max-lg:gap-3 max-lg:px-4 max-lg:pb-[max(13px,env(safe-area-inset-bottom))] ${settled ? "pointer-events-none opacity-0" : ""}`}
      >
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          className="focus-ring flex items-center gap-2 rounded-[10px] border border-line-2 px-3 py-3 text-[12.5px] font-medium text-on-surface-2 transition-colors hover:bg-white/5 lg:hidden"
        >
          Transcript
        </button>
        {(phase !== "open" || Boolean(session.currentTopic)) && (
          <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2 max-lg:hidden">
            {phase === "open" ? `${session.currentTopic} under discussion` : "Closing"}
          </span>
        )}
        {sessionOver ? (
          <button
            type="button"
            onClick={handleEndSession}
            className="focus-ring ml-auto flex items-center gap-2 rounded-[10px] bg-red px-[18px] py-2.5 text-[13.5px] font-medium text-white shadow-btn transition-colors hover:bg-red-deep"
          >
            Get the debrief <span aria-hidden="true">→</span>
          </button>
        ) : landing ? (
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2 max-lg:min-w-0 max-lg:truncate">
            Wrapping up. Your debrief is next.
          </span>
        ) : (
          // A mis-click here throws away a live conversation — confirm, and
          // let the confirmation promise what comes next.
          <AlertDialog>
            <AlertDialogTrigger className="focus-ring ml-auto flex items-center gap-2 rounded-[10px] bg-red px-[18px] py-2.5 text-[13.5px] font-medium text-white shadow-btn transition-colors hover:bg-red-deep">
              End session <span aria-hidden="true">→</span>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm" data-surface="dark">
              <AlertDialogHeader>
                <AlertDialogTitle>End session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {firstNameOf(persona.name)} will write your debrief.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndSession}>End session</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <aside
        className={`col-start-3 row-span-2 row-start-1 flex min-h-0 flex-col border-l border-line bg-surface-raised transition-opacity duration-700 motion-reduce:transition-none max-lg:hidden ${settled ? "pointer-events-none opacity-0" : ""}`}
      >
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

      {/* The transcript column, as a sheet, for viewports that lost it. */}
      {mobilePanelOpen && !settled && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close transcript"
            onClick={() => setMobilePanelOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[72dvh] flex-col border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] [@media(max-height:520px)]:h-[92dvh]">
            <div className="flex flex-none items-center justify-between border-b border-line py-1 pl-[18px] pr-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
                Transcript &amp; notes
              </span>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                aria-label="Close transcript"
                className="focus-ring grid size-11 place-items-center rounded-lg text-on-surface-3 transition-colors hover:bg-white/5"
              >
                <X className="size-4" />
              </button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  )
}

export const RoomShell = ({ simulationId, onSettled }: RoomShellProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const session = useQuery(api.sessions.getLive, { practiceId: typedId })
  const practice = useQuery(api.practices.get, { id: typedId })
  // Owned here, used by the body: the body's landing and end paths set it
  // before navigating, so the redirect below can't race them.
  const endedRef = useRef(false)
  // The landing concludes the session at its very start, and getLive only
  // returns live rows — so `session` goes null a round trip into a landing
  // that still has seconds to run. Holding the last live copy keeps the body
  // (its landing screen, its avatar session, and the transcript bridge still
  // writing trailing finals) mounted until it navigates itself away.
  const [heldSession, setHeldSession] = useState<Doc<"sessions"> | null>(null)
  const liveSessionRef = useRef<Doc<"sessions"> | null>(null)
  useEffect(() => {
    liveSessionRef.current = session ?? null
  }, [session])
  // Argument-free on purpose: taking the session from the ref keeps this
  // callback — and with it the body's handleLand and the interval that
  // depends on it — stable while transcript updates stream in.
  const handleLanding = useCallback(
    () => setHeldSession((prev) => liveSessionRef.current ?? prev),
    []
  )

  // No live session for this practice means the user hasn't chosen a
  // panelist (or the session concluded) — send them to the meet step.
  // The end-session path guards with endedRef.current so its own navigation
  // isn't raced by this redirect.
  useEffect(() => {
    if (session === null && !endedRef.current) {
      router.replace(`/simulation/${simulationId}/panel`)
    }
  }, [session, router, simulationId])

  const shown = session ?? heldSession

  // Wait for the practice too: getPack falls back to the founder pack, so
  // rendering before packId arrives would flash founder labels in a sales room.
  if (shown === null || practice === undefined) return null

  return (
    <RoomShellBody
      session={shown}
      practice={practice}
      simulationId={simulationId}
      endedRef={endedRef}
      onLanding={handleLanding}
      onSettled={onSettled}
    />
  )
}
