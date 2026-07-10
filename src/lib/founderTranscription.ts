import { z } from "zod"

const STREAM_URL = "wss://streaming.assemblyai.com/v3/ws"
const TARGET_SAMPLE_RATE = 16000
const STOP_FLUSH_TIMEOUT_MS = 3000
const MAX_CONSECUTIVE_RECONNECTS = 2

const tokenResponseSchema = z.object({ token: z.string() })

const turnMessageSchema = z.object({
  type: z.literal("Turn"),
  turn_order: z.number(),
  transcript: z.string(),
  end_of_turn: z.boolean(),
  turn_is_formatted: z.boolean(),
  // Word timings in ms relative to the start of the streamed audio.
  words: z
    .array(z.object({ start: z.number(), end: z.number() }))
    .optional(),
})

const terminationMessageSchema = z.object({ type: z.literal("Termination") })

export type FounderTranscriptionStatus =
  | "connecting"
  | "streaming"
  | "denied"
  | "error"
  | "ended"

export type FounderTranscriptionHandlers = {
  // Fired exactly once per committed turn, in speech order (a turn commits on
  // AssemblyAI's formatted end-of-turn event, or when a session flushes on
  // stop / mid-stream drop so no heard speech is ever lost). spokenAt is the
  // wall-clock ms the turn's first word was spoken — word offsets anchored to
  // when this session's audio stream began — or null if timing was missing.
  onFinalTurn: (text: string, spokenAt: number | null) => void
  // Latest in-progress (not yet committed) text; "" when it commits or clears.
  onInterim: (text: string) => void
  // "denied"/"error" are terminal; "ended" means the stream stopped itself
  // (mic revoked) after flushing — external stop()/dispose() do not emit it.
  onStatus: (status: FounderTranscriptionStatus) => void
  // RMS (0..1) of each ~100ms PCM chunk. Called at audio rate — no React
  // state per call.
  onAudioLevel?: (rms: number) => void
}

export type FounderTranscription = {
  // Graceful stop: Terminate → server flush (≤3s) → pending turns emitted
  // through onFinalTurn → resolves. Idempotent.
  stop: () => Promise<void>
  // Immediate teardown; no callbacks fire afterwards.
  dispose: () => void
}

// The founder-side capture transport proven in the intake (Phase 1):
// mic → AudioWorklet (mono 16-bit PCM) → browser-direct AssemblyAI streaming
// WebSocket, authenticated with a short-lived token from
// /api/transcribe/token. Audio never passes through our server, and
// endpointing is entirely AssemblyAI's VAD — no client silence timers.
// This transcribes the FOUNDER only; the avatar's speech is transcribed by
// Runway (useTranscription) and is a separate pipeline.
export const startFounderTranscription = (
  handlers: FounderTranscriptionHandlers
): FounderTranscription => {
  let disposed = false
  let stopping = false
  let finished = false
  let reconnectsLeft = MAX_CONSECUTIVE_RECONNECTS
  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let socket: WebSocket | null = null
  let flushTimeout: ReturnType<typeof setTimeout> | null = null
  let resolveStop: (() => void) | null = null

  // Word offsets are relative to the audio this socket's session has
  // received, which begins with the first PCM chunk actually sent while the
  // socket is open — chunks produced earlier are dropped, so getUserMedia
  // time is NOT the anchor. Reset per session (reconnects restart offsets).
  let audioAnchor: number | null = null

  // Uncommitted turns for the current socket session; turn_order restarts
  // per session, so the map flushes whenever a session ends.
  const turns = new Map<
    number,
    { text: string; final: boolean; spokenAt: number | null }
  >()

  const spokenAtFor = (words?: { start: number }[]) =>
    audioAnchor !== null && words && words.length > 0
      ? audioAnchor + words[0].start
      : null

  const pendingText = () =>
    [...turns.entries()]
      .filter(([, turn]) => turn.text.length > 0)
      .sort(([a], [b]) => a - b)
      .map(([, turn]) => turn.text)
      .join(" ")

  const flushSession = () => {
    const pending = [...turns.entries()]
      .filter(([, turn]) => turn.text.length > 0)
      .sort(([a], [b]) => a - b)
    turns.clear()
    if (disposed) return
    for (const [, turn] of pending) handlers.onFinalTurn(turn.text, turn.spokenAt)
    handlers.onInterim("")
  }

  // Releasing capture is separate from teardown so stop() can free the mic
  // (browser recording indicator included) immediately, while the socket
  // stays open for the server flush.
  const releaseCapture = () => {
    workletNode?.disconnect()
    workletNode = null
    audioContext?.close().catch(() => {})
    audioContext = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  const teardown = () => {
    if (flushTimeout) clearTimeout(flushTimeout)
    releaseCapture()
    if (socket) {
      socket.onclose = null
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "Terminate" }))
        socket.close()
      }
      socket = null
    }
  }

  const finish = () => {
    if (finished) return
    finished = true
    flushSession()
    teardown()
    resolveStop?.()
  }

  const fail = () => {
    finished = true
    teardown()
    if (!disposed) handlers.onStatus("error")
  }

  const handleMessage = (event: MessageEvent) => {
    if (disposed || finished || typeof event.data !== "string") return
    let data: unknown
    try {
      data = JSON.parse(event.data)
    } catch {
      return
    }
    const turn = turnMessageSchema.safeParse(data)
    if (turn.success) {
      const text = turn.data.transcript.trim()
      const spokenAt = spokenAtFor(turn.data.words)
      if (turn.data.end_of_turn && turn.data.turn_is_formatted) {
        turns.delete(turn.data.turn_order)
        if (text.length > 0) handlers.onFinalTurn(text, spokenAt)
      } else {
        turns.set(turn.data.turn_order, {
          text,
          final: turn.data.end_of_turn,
          spokenAt,
        })
      }
      handlers.onInterim(pendingText())
      return
    }
    if (stopping && terminationMessageSchema.safeParse(data).success) {
      finish()
    }
  }

  const handleClose = () => {
    if (disposed || finished) return
    if (stopping) {
      finish()
      return
    }
    // Mid-stream drop: commit what we heard, resume on a fresh session.
    flushSession()
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
      if (disposed || finished || !audioContext) return

      const params = new URLSearchParams({
        token: parsed.data.token,
        sample_rate: String(audioContext.sampleRate),
        encoding: "pcm_s16le",
        format_turns: "true",
      })
      const ws = new WebSocket(`${STREAM_URL}?${params.toString()}`)
      ws.onopen = () => {
        audioAnchor = null
        if (disposed || finished || stopping) return
        // A live session proves the path works; give future drops a fresh
        // retry budget so long room sessions survive more than two blips.
        reconnectsLeft = MAX_CONSECUTIVE_RECONNECTS
        handlers.onStatus("streaming")
      }
      ws.onmessage = handleMessage
      ws.onclose = handleClose
      socket = ws
    } catch {
      if (disposed || finished) return
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
      if (!disposed) handlers.onStatus("denied")
      return
    }
    // stop()/dispose() can complete while getUserMedia is still pending
    // (StrictMode's throwaway mount does exactly this) — the late-arriving
    // stream must be stopped here or the mic stays live with no owner.
    if (disposed || finished || stopping) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
      return
    }
    // Mic revoked mid-stream (track.stop() in teardown does not fire this):
    // flush what was heard and end rather than streaming dead air.
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (disposed || stopping || finished) return
        finished = true
        flushSession()
        teardown()
        if (!disposed) handlers.onStatus("ended")
      }
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
      // Same late-arrival race as above: capture opened during the await
      // must be released if the stream was stopped meanwhile.
      if (disposed || finished || stopping) {
        releaseCapture()
        return
      }
      const source = audioContext.createMediaStreamSource(stream)
      workletNode = new AudioWorkletNode(audioContext, "pcm-recorder", {
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: "explicit",
      })
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (handlers.onAudioLevel && !disposed) {
          const pcm = new Int16Array(event.data)
          let sumOfSquares = 0
          for (let i = 0; i < pcm.length; i++) sumOfSquares += pcm[i] * pcm[i]
          handlers.onAudioLevel(Math.sqrt(sumOfSquares / pcm.length) / 32768)
        }
        if (!stopping && socket?.readyState === WebSocket.OPEN) {
          if (audioAnchor === null) audioAnchor = Date.now()
          socket.send(event.data)
        }
      }
      source.connect(workletNode)
    } catch {
      if (!disposed) fail()
      return
    }

    await connect()
  }

  start()

  let stopPromise: Promise<void> | null = null
  const stop = () => {
    if (finished) return Promise.resolve()
    if (stopPromise) return stopPromise
    stopping = true
    // Free the mic now — the indicator must clear on stop, not after the
    // flush. No transcript is lost: audio was never sent while stopping,
    // and the server flush drains what it already received.
    releaseCapture()
    stopPromise = new Promise<void>((resolve) => {
      resolveStop = resolve
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Terminate makes the server flush the in-progress turn, send
        // Termination, and close; the timeout covers a hung wind-down.
        socket.send(JSON.stringify({ type: "Terminate" }))
        flushTimeout = setTimeout(finish, STOP_FLUSH_TIMEOUT_MS)
      } else {
        finish()
      }
    })
    return stopPromise
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    finished = true
    teardown()
    resolveStop?.()
  }

  return { stop, dispose }
}
