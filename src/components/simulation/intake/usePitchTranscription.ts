"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

const STREAM_URL = "wss://streaming.assemblyai.com/v3/ws"
const TARGET_SAMPLE_RATE = 16000
const STOP_FLUSH_TIMEOUT_MS = 3000
const MAX_RECONNECTS = 2

const tokenResponseSchema = z.object({ token: z.string() })

const turnMessageSchema = z.object({
  type: z.literal("Turn"),
  turn_order: z.number(),
  transcript: z.string(),
  end_of_turn: z.boolean(),
  turn_is_formatted: z.boolean(),
})

const terminationMessageSchema = z.object({ type: z.literal("Termination") })

export type TranscriptionStatus =
  | "connecting"
  | "listening"
  | "finishing"
  | "denied"
  | "error"

type PitchTranscription = {
  status: TranscriptionStatus
  finals: string[]
  heardSpeech: boolean
  stop: () => void
}

// Founder-side capture pipeline: mic → AudioWorklet (mono 16-bit PCM) →
// browser-direct AssemblyAI streaming WebSocket, authenticated with a
// short-lived token minted by /api/transcribe/token. Audio never passes
// through our server. AssemblyAI's built-in VAD promotes interim turns to
// finals on its end-of-turn events — there is no client silence timer.
// Interim turns are tracked internally (turn-state idempotency, and any
// leftover interim joins the transcript on stop) but only finals are exposed:
// intake deliberately shows confirmed text only. The room's live transcript
// (Phase 3) should render interims — don't inherit this omission there.
// Runs once per mount; onFinished fires exactly once with the assembled
// transcript after stop() and server flush. onAudioLevel reports the RMS
// (0..1) of each ~100ms PCM chunk so the UI can render real mic amplitude —
// callers must not set React state per call.
export const usePitchTranscription = (
  onFinished: (transcript: string) => void,
  onAudioLevel: (rms: number) => void
): PitchTranscription => {
  const [status, setStatus] = useState<TranscriptionStatus>("connecting")
  const [finals, setFinals] = useState<string[]>([])
  const [heardSpeech, setHeardSpeech] = useState(false)
  const stopRef = useRef<() => void>(() => {})

  // Latest-refs so the mount-once lifecycle below survives parent re-renders.
  const onFinishedRef = useRef(onFinished)
  const onAudioLevelRef = useRef(onAudioLevel)
  useEffect(() => {
    onFinishedRef.current = onFinished
    onAudioLevelRef.current = onAudioLevel
  }, [onFinished, onAudioLevel])

  useEffect(() => {
    let cancelled = false
    let stopping = false
    let finished = false
    let reconnectsLeft = MAX_RECONNECTS
    let stream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let workletNode: AudioWorkletNode | null = null
    let socket: WebSocket | null = null
    let flushTimeout: ReturnType<typeof setTimeout> | null = null

    // Turns finalized in dropped sessions; turn_order restarts per session,
    // so each socket's turns live in `turns` and flush here on close.
    const committed: string[] = []
    const turns = new Map<number, { text: string; final: boolean }>()

    const sessionFinals = () =>
      [...turns.entries()]
        .filter(([, turn]) => turn.final && turn.text.length > 0)
        .sort(([a], [b]) => a - b)
        .map(([, turn]) => turn.text)

    const sessionInterim = () =>
      [...turns.entries()]
        .filter(([, turn]) => !turn.final && turn.text.length > 0)
        .sort(([a], [b]) => a - b)
        .map(([, turn]) => turn.text)
        .join(" ")

    const publish = () => {
      if (cancelled) return
      setFinals([...committed, ...sessionFinals()])
    }

    const flushSession = () => {
      committed.push(...sessionFinals())
      const leftover = sessionInterim()
      if (leftover) committed.push(leftover)
      turns.clear()
    }

    const teardown = () => {
      if (flushTimeout) clearTimeout(flushTimeout)
      workletNode?.disconnect()
      workletNode = null
      audioContext?.close().catch(() => {})
      audioContext = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      if (socket) {
        socket.onclose = null
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "Terminate" }))
          socket.close()
        }
        socket = null
      }
    }

    const finalize = () => {
      if (finished) return
      finished = true
      flushSession()
      teardown()
      if (!cancelled) onFinishedRef.current(committed.join(" ").trim())
    }

    const fail = () => {
      teardown()
      if (!cancelled) setStatus("error")
    }

    const handleMessage = (event: MessageEvent) => {
      if (cancelled || finished || typeof event.data !== "string") return
      let data: unknown
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }
      const turn = turnMessageSchema.safeParse(data)
      if (turn.success) {
        const text = turn.data.transcript.trim()
        turns.set(turn.data.turn_order, {
          text,
          final: turn.data.end_of_turn,
        })
        if (text.length > 0) setHeardSpeech(true)
        publish()
        return
      }
      if (stopping && terminationMessageSchema.safeParse(data).success) {
        finalize()
      }
    }

    const handleClose = () => {
      if (cancelled || finished) return
      if (stopping) {
        finalize()
        return
      }
      // Mid-stream drop: keep what we have, resume on a fresh session.
      flushSession()
      publish()
      if (reconnectsLeft > 0) {
        reconnectsLeft -= 1
        connect()
      } else {
        fail()
      }
    }

    const connect = async () => {
      try {
        const response = await fetch("/api/transcribe/token")
        if (!response.ok) throw new Error(`token mint failed: ${response.status}`)
        const parsed = tokenResponseSchema.safeParse(await response.json())
        if (!parsed.success) throw new Error("unexpected token response")
        if (cancelled || finished || !audioContext) return

        const params = new URLSearchParams({
          token: parsed.data.token,
          sample_rate: String(audioContext.sampleRate),
          encoding: "pcm_s16le",
          format_turns: "true",
        })
        const ws = new WebSocket(`${STREAM_URL}?${params.toString()}`)
        ws.onopen = () => {
          if (!cancelled && !finished && !stopping) setStatus("listening")
        }
        ws.onmessage = handleMessage
        ws.onclose = handleClose
        socket = ws
      } catch {
        if (cancelled || finished) return
        if (reconnectsLeft > 0) {
          reconnectsLeft -= 1
          connect()
        } else {
          fail()
        }
      }
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        if (!cancelled) setStatus("denied")
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      // Mic revoked mid-pitch (track.stop() in teardown does not fire this):
      // finish with whatever was heard rather than streaming dead air.
      stream.getTracks().forEach((track) => {
        track.onended = () => stopRef.current()
      })

      try {
        try {
          audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
        } catch {
          // Browser refused 16kHz; stream at its native rate instead —
          // AssemblyAI accepts any rate via the sample_rate param.
          audioContext = new AudioContext()
        }
        void audioContext.resume().catch(() => {})
        await audioContext.audioWorklet.addModule("/pcm-recorder.worklet.js")
        if (cancelled) return
        const source = audioContext.createMediaStreamSource(stream)
        workletNode = new AudioWorkletNode(audioContext, "pcm-recorder", {
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: "explicit",
        })
        workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          const pcm = new Int16Array(event.data)
          let sumOfSquares = 0
          for (let i = 0; i < pcm.length; i++) sumOfSquares += pcm[i] * pcm[i]
          onAudioLevelRef.current(Math.sqrt(sumOfSquares / pcm.length) / 32768)
          if (!stopping && socket?.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        }
        source.connect(workletNode)
      } catch {
        if (!cancelled) fail()
        return
      }

      await connect()
    }

    const requestStop = () => {
      if (cancelled || stopping || finished) return
      stopping = true
      setStatus("finishing")
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Terminate makes the server flush the in-progress turn, send
        // Termination, and close; the timeout covers a hung wind-down.
        socket.send(JSON.stringify({ type: "Terminate" }))
        flushTimeout = setTimeout(finalize, STOP_FLUSH_TIMEOUT_MS)
      } else {
        finalize()
      }
    }
    stopRef.current = requestStop

    start()

    return () => {
      cancelled = true
      teardown()
    }
  }, [])

  const stop = useCallback(() => stopRef.current(), [])

  return { status, finals, heardSpeech, stop }
}
