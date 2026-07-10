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
  finals: string[]
  heardSpeech: boolean
  stop: () => void
}

// Intake pitch capture on the shared founder-transcription core. Interim
// turns are tracked by the core (turn idempotency; leftovers join the
// transcript on stop) but only finals are exposed: intake deliberately shows
// confirmed text only. The room's live transcript renders interims — don't
// inherit this omission there. Runs once per mount; onFinished fires exactly
// once with the assembled transcript. onAudioLevel reports per-chunk mic RMS
// (0..1) — callers must not set React state per call.
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
    let stopRequested = false
    let cancelled = false
    const collected: string[] = []
    const finishOnce = () => {
      if (!cancelled) onFinishedRef.current(collected.join(" ").trim())
    }

    const stream = startFounderTranscription({
      onFinalTurn: (text) => {
        collected.push(text)
        setFinals([...collected])
        setHeardSpeech(true)
      },
      onInterim: (text) => {
        if (text.length > 0) setHeardSpeech(true)
      },
      onStatus: (streamStatus) => {
        if (streamStatus === "streaming") setStatus("listening")
        if (streamStatus === "denied") setStatus("denied")
        if (streamStatus === "error") setStatus("error")
        // Mic revoked mid-pitch: the core has flushed; finish with what we
        // heard rather than sitting in a dead "listening" state.
        if (streamStatus === "ended" && !stopRequested) finishOnce()
      },
      onAudioLevel: (rms) => onAudioLevelRef.current(rms),
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

  return { status, finals, heardSpeech, stop }
}
