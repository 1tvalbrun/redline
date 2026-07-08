"use client"

import { useEffect, useRef, useState } from "react"
import { cn, formatElapsed } from "@/lib/utils"
import { FLOW_BTN } from "@/components/simulation/flow/FlowShell"

const CHUNK_MS = 6000
const MAX_PITCH_MS = 90_000
const CUE_AFTER_MS = 12_000
const MIN_CHUNK_TEXT = 4

// Static classes so Tailwind compiles them; cycled across the 48 bars.
const BAR_DELAYS = [
  "",
  "[animation-delay:.12s]",
  "[animation-delay:.24s]",
  "[animation-delay:.36s]",
  "[animation-delay:.48s]",
  "[animation-delay:.6s]",
  "[animation-delay:.72s]",
  "[animation-delay:.84s]",
]
const BAR_DURATIONS = [
  "[animation-duration:.7s]",
  "[animation-duration:.9s]",
  "[animation-duration:1.1s]",
  "[animation-duration:1.3s]",
]
const BARS = Array.from({ length: 48 }, (_, i) =>
  cn("w-1 rounded-[2px] bg-on-surface animate-eq h-[12%]", BAR_DELAYS[i % 8], BAR_DURATIONS[(i * 7) % 4])
)

type RecorderState = "starting" | "denied" | "recording" | "finishing" | "silent"

type PitchRecorderProps = {
  guided: boolean
  onComplete: (transcript: string, seconds: number) => void
  onCancel: () => void
  // Fresh takes remount the recorder (parent bumps its key).
  onRetry: () => void
}

export const PitchRecorder = ({ guided, onComplete, onCancel, onRetry }: PitchRecorderProps) => {
  const [state, setState] = useState<RecorderState>("starting")
  const [elapsedMs, setElapsedMs] = useState(0)
  const [heard, setHeard] = useState<string[]>([])
  const stopRef = useRef<() => void>(() => {})

  // Latest-ref: the recording lifecycle must survive parent re-renders, so
  // the media effect runs once per mount and reads the current callback here.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let recorder: MediaRecorder | null = null
    let tick: ReturnType<typeof setInterval> | null = null
    let chunkIndex = 0
    let elapsed = 0
    let pending = 0
    let stopRequested = false
    let recorderStopped = false
    const chunks: string[] = []

    const finalizeIfDone = () => {
      if (cancelled || !stopRequested || !recorderStopped || pending > 0) return
      const transcript = chunks.filter(Boolean).join(" ").trim()
      if (transcript.length === 0) {
        setState("silent")
      } else {
        onCompleteRef.current(transcript, Math.round(elapsed / 1000))
      }
    }

    const transcribeChunk = async (blob: Blob, index: number) => {
      pending += 1
      try {
        const form = new FormData()
        form.append("audio", blob, "chunk.webm")
        const response = await fetch("/api/transcribe", { method: "POST", body: form })
        if (response.ok) {
          const { text } = (await response.json()) as { text: string }
          if (text.trim().length >= MIN_CHUNK_TEXT) {
            chunks[index] = text.trim()
            if (!cancelled) setHeard(chunks.filter(Boolean))
          }
        }
      } catch {
        // A dropped chunk loses a few seconds of speech; the founder reviews
        // and edits the assembled brief, so keep going rather than abort.
      } finally {
        pending -= 1
        finalizeIfDone()
      }
    }

    const recordChunk = () => {
      if (cancelled || stopRequested || !stream) return
      recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      const index = chunkIndex++
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) transcribeChunk(e.data, index)
      }
      recorder.onstop = () => {
        if (stopRequested) {
          recorderStopped = true
          finalizeIfDone()
        } else {
          recordChunk()
        }
      }
      recorder.start()
      setTimeout(() => {
        if (recorder?.state === "recording") recorder.stop()
      }, CHUNK_MS)
    }

    const requestStop = () => {
      if (stopRequested || cancelled) return
      stopRequested = true
      if (tick) clearInterval(tick)
      setState("finishing")
      if (recorder?.state === "recording") {
        recorder.stop()
      } else {
        recorderStopped = true
        finalizeIfDone()
      }
    }
    stopRef.current = requestStop

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        setState("recording")
        recordChunk()
        tick = setInterval(() => {
          elapsed += 1000
          setElapsedMs(elapsed)
          if (elapsed >= MAX_PITCH_MS) requestStop()
        }, 1000)
      })
      .catch(() => {
        if (!cancelled) setState("denied")
      })

    return () => {
      cancelled = true
      if (tick) clearInterval(tick)
      stopRequested = true
      if (recorder?.state === "recording") recorder.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const cueVisible = state === "recording" && (guided || elapsedMs >= CUE_AFTER_MS)

  if (state === "denied" || state === "silent") {
    return (
      <div className="flex flex-1 flex-col items-start justify-center">
        <p role="alert" className="max-w-[44ch] text-[17px] leading-[1.5] text-on-surface">
          {state === "denied"
            ? "We can't hear you — microphone access is blocked. Allow it in your browser and try again, or type your pitch instead."
            : "We couldn't catch any speech in that take. Try again a little closer to the mic, or type it instead."}
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
        <span className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[.14em] text-red-fg">
          <span aria-hidden="true" className="h-[9px] w-[9px] animate-pulse-red rounded-full bg-red" />
          {state === "starting" ? "Requesting microphone…" : state === "finishing" ? "Wrapping up…" : "Listening"}
        </span>
        <span className="font-mono text-sm tracking-[.1em] tabular-nums text-on-surface-2">
          {formatElapsed(0, elapsedMs)}
        </span>
      </div>

      <div aria-hidden="true" className="my-2.5 mb-8 flex h-[90px] items-center justify-center gap-1">
        {BARS.map((barClass, i) => (
          <span key={i} className={cn(barClass, state !== "recording" && "animate-none")} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[120px] max-w-[60ch] flex-1 text-[22px] leading-[1.6]">
        <span className="text-on-surface">{heard.join(" ")}</span>
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
          onClick={() => stopRef.current()}
          disabled={state !== "recording"}
          className={FLOW_BTN}
        >
          ✓ That&apos;s my pitch
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
