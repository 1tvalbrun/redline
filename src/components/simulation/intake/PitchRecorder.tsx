"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { formatElapsed } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FLOW_BTN } from "@/components/simulation/flow/FlowShell"
import { usePitchTranscription } from "./usePitchTranscription"

const MAX_PITCH_MS = 90_000
const CUE_AFTER_MS = 12_000
const BAR_COUNT = 48
// sqrt compresses the RMS range so quiet speech still registers; the gain
// puts a normal speaking level near full height. Silence stays at baseline.
const barHeight = (rms: number) => `${6 + Math.min(1, Math.sqrt(rms) * 2.4) * 94}%`

const paintBars = (container: HTMLDivElement, levels: number[]) => {
  const offset = BAR_COUNT - levels.length
  for (let i = 0; i < levels.length; i++) {
    ;(container.children[offset + i] as HTMLElement).style.height = barHeight(levels[i])
  }
}

const resetBars = (container: HTMLDivElement) => {
  for (const bar of container.children) {
    ;(bar as HTMLElement).style.height = ""
  }
}

const BLOCKED_MESSAGES = {
  denied:
    "We can't hear you — microphone access is blocked. Allow it in your browser and try again, or type your pitch instead.",
  silent:
    "We couldn't catch any speech in that take. Try again a little closer to the mic, or type it instead.",
  error:
    "We hit a problem with the transcription connection. Try again, or type your pitch instead.",
}

type PitchRecorderProps = {
  guided: boolean
  onComplete: (transcript: string, seconds: number) => void
  onCancel: () => void
  // Fresh takes remount the recorder (parent bumps its key).
  onRetry: () => void
}

export const PitchRecorder = ({ guided, onComplete, onCancel, onRetry }: PitchRecorderProps) => {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [silent, setSilent] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const elapsedRef = useRef(0)
  const barsRef = useRef<HTMLDivElement>(null)
  const levelsRef = useRef<number[]>([])
  const listeningRef = useRef(false)
  const reduceMotionRef = useRef(false)
  useEffect(() => {
    reduceMotionRef.current = matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Latest-ref: the transcription lifecycle runs once per mount and must
  // survive parent re-renders, so it reads the current callback here.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const handleFinished = useCallback((transcript: string) => {
    if (transcript.length === 0) {
      setSilent(true)
    } else {
      onCompleteRef.current(transcript, Math.round(elapsedRef.current / 1000))
    }
  }, [])

  // Scrolls a per-chunk amplitude history across the bars (newest at the
  // right) by writing heights directly — audio arrives ~10×/s and must not
  // re-render React; the CSS height transition smooths between updates.
  const handleAudioLevel = useCallback((rms: number) => {
    const bars = barsRef.current
    if (!bars || !listeningRef.current || reduceMotionRef.current) return
    const levels = levelsRef.current
    levels.push(rms)
    if (levels.length > BAR_COUNT) levels.shift()
    paintBars(bars, levels)
  }, [])

  const { status, finals, heardSpeech, stop } = usePitchTranscription(handleFinished, handleAudioLevel)

  useEffect(() => {
    listeningRef.current = status === "listening"
    if (listeningRef.current || !barsRef.current) return
    levelsRef.current = []
    resetBars(barsRef.current)
  }, [status])

  const handleStartOver = () => {
    if (heardSpeech) {
      setConfirmingDiscard(true)
    } else {
      onCancel()
    }
  }

  useEffect(() => {
    if (status !== "listening") return
    const tick = setInterval(() => {
      elapsedRef.current += 1000
      setElapsedMs(elapsedRef.current)
      if (elapsedRef.current >= MAX_PITCH_MS) stop()
    }, 1000)
    return () => clearInterval(tick)
  }, [status, stop])

  const cueVisible = status === "listening" && (guided || elapsedMs >= CUE_AFTER_MS)
  const blocked = silent ? "silent" : status === "denied" || status === "error" ? status : null

  if (blocked) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center">
        <p role="alert" className="max-w-[44ch] text-[17px] leading-[1.5] text-on-surface">
          {BLOCKED_MESSAGES[blocked]}
        </p>
        <div className="mt-7 flex items-center gap-3.5">
          <button type="button" onClick={onRetry} className={FLOW_BTN}>
            Try again
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-7 flex items-center justify-between">
        <span
          role="status"
          className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[.14em] text-red-fg"
        >
          <span aria-hidden="true" className="h-[9px] w-[9px] animate-pulse-red rounded-full bg-red" />
          {status === "connecting" ? "Requesting microphone…" : status === "finishing" ? "Wrapping up…" : "Listening"}
        </span>
        <span className="font-mono text-sm tracking-[.1em] tabular-nums text-on-surface-2">
          {formatElapsed(0, elapsedMs)}
        </span>
      </div>

      <div
        ref={barsRef}
        aria-hidden="true"
        className="my-2.5 mb-8 flex h-[90px] items-center justify-center gap-1"
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            className="h-[6%] w-1 rounded-[2px] bg-on-surface transition-[height] duration-150 ease-out"
          />
        ))}
      </div>

      <div className="min-h-[120px] max-w-[60ch] flex-1 text-[22px] leading-[1.6]">
        <span aria-live="polite" className="text-on-surface">
          {finals.join(" ")}
        </span>
        <span aria-hidden="true" className="ml-[3px] inline-block h-6 w-[9px] animate-blink bg-red align-[-4px]" />
      </div>

      {cueVisible && (
        <p className="mt-6 inline-flex items-center gap-2 self-start border border-dashed border-line-2 bg-surface-raised px-[15px] py-2.5 text-[13px] text-on-surface-2">
          <b className="font-semibold text-on-surface">If you can,</b> mention why now: what
          changed that makes this the moment?
        </p>
      )}

      <div className="mt-8 flex items-center gap-3.5">
        <button
          type="button"
          onClick={stop}
          disabled={status !== "listening"}
          className={FLOW_BTN}
        >
          ✓ That&apos;s my pitch
        </button>
        <button
          type="button"
          onClick={handleStartOver}
          className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
        >
          Start over
        </button>
      </div>

      <AlertDialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this pitch?</AlertDialogTitle>
            <AlertDialogDescription>
              Your recording so far will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep recording</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onCancel}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
