"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { startFounderTranscription } from "@/lib/founderTranscription"

export type TranscriptionStatus =
  | "connecting"
  | "listening"
  | "finishing"
  | "denied"
  | "error"

type PitchTranscription = {
  status: TranscriptionStatus
  stop: () => void
}

// Intake pitch capture on the shared founder-transcription core. Interim
// turns are tracked by the core (turn idempotency; leftovers join the
// transcript on stop) but only finals are collected: confirmed text only,
// the same rule the room's transcript follows (UserSpeechBridge also
// discards interims). Runs once per mount; onFinished fires exactly once
// with the assembled transcript.
export const usePitchTranscription = (
  onFinished: (transcript: string) => void
): PitchTranscription => {
  const [status, setStatus] = useState<TranscriptionStatus>("connecting")
  const stopRef = useRef<() => void>(() => {})

  // Latest-ref so the mount-once lifecycle below survives parent re-renders.
  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  useEffect(() => {
    let stopRequested = false
    let cancelled = false
    const collected: string[] = []
    const finishOnce = () => {
      if (!cancelled) onFinishedRef.current(collected.join(" ").trim())
    }

    const stream = startFounderTranscription({
      onFinalTurn: (text) => {
        collected.push(text)
      },
      onInterim: () => {},
      onStatus: (streamStatus) => {
        if (streamStatus === "streaming") setStatus("listening")
        if (streamStatus === "denied") setStatus("denied")
        if (streamStatus === "error") setStatus("error")
        // Mic revoked mid-pitch: the core has flushed; finish with what we
        // heard rather than sitting in a dead "listening" state.
        if (streamStatus === "ended" && !stopRequested) finishOnce()
      },
    })

    stopRef.current = () => {
      if (stopRequested) return
      stopRequested = true
      setStatus("finishing")
      void stream.stop().then(finishOnce)
    }

    return () => {
      cancelled = true
      stream.dispose()
    }
  }, [])

  const stop = useCallback(() => stopRef.current(), [])

  return { status, stop }
}
