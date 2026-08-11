"use client"

import { useEffect, useState } from "react"
import { Keyboard, Mic, Upload, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatElapsed } from "@/lib/utils"
import type { DomainPack } from "@/domains/types"
import { usePitchTranscription } from "./usePitchTranscription"

const MAX_PITCH_MS = 90_000

const ERROR_MESSAGES: Record<string, string> = {
  denied:
    "We can't hear you. Microphone access is blocked. Allow it in your browser and try again, or type it instead.",
  silent: "We couldn't catch any speech in that take. Try again a little closer to the mic, or type it instead.",
  error: "We hit a problem with the transcription connection. Try again, or type it instead.",
}

// Mounted only while recording — usePitchTranscription runs once per mount,
// so a fresh take is a fresh mount (parent bumps the key).
const Capture = ({
  onDone,
  onError,
}: {
  onDone: (transcript: string, seconds: number) => void
  onError: (kind: "denied" | "silent" | "error") => void
}) => {
  const [elapsedMs, setElapsedMs] = useState(0)

  const handleFinished = (transcript: string) => {
    if (transcript.length === 0) return onError("silent")
    onDone(transcript, Math.round(elapsedMs / 1000))
  }

  const { status, stop } = usePitchTranscription(handleFinished, () => {})

  useEffect(() => {
    if (status === "denied" || status === "error") onError(status)
  }, [status, onError])

  // Timer ticks while the stream listens; the cap effect stops the stream
  // (an external system) when the limit is reached — never from inside a
  // state updater, which must stay pure.
  useEffect(() => {
    if (status !== "listening") return
    const tick = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000)
    return () => clearInterval(tick)
  }, [status])

  useEffect(() => {
    if (elapsedMs >= MAX_PITCH_MS) stop()
  }, [elapsedMs, stop])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-[-8px] animate-ring rounded-full border-2 border-red" />
        <span
          aria-hidden="true"
          className="absolute inset-[-8px] animate-ring rounded-full border-2 border-red [animation-delay:.9s]"
        />
        <span className="grid h-[84px] w-[84px] place-items-center rounded-full bg-red text-white shadow-btn">
          <Mic className="size-[30px]" />
        </span>
      </div>
      <p role="status" className="text-sm font-semibold">
        {status === "connecting" ? "Requesting microphone" : status === "finishing" ? "Wrapping up" : "Listening"}
      </p>
      <p className="font-mono text-[13px] tabular-nums text-on-surface-2">
        {formatElapsed(0, elapsedMs)}
      </p>
      <button
        type="button"
        onClick={stop}
        disabled={status !== "listening"}
        className="focus-ring inline-flex items-center gap-2 rounded-[10px] bg-on-surface px-[18px] py-[9px] text-[13.5px] font-medium text-surface shadow-btn transition hover:opacity-90 disabled:opacity-50"
      >
        <Check className="size-3.5" strokeWidth={2.4} />
        I&apos;m done
      </button>
    </div>
  )
}

type TellItProps = {
  pack: DomainPack
  onTranscript: (transcript: string, seconds: number) => void
  onTypeInstead: () => void
  onAddDocuments: () => void
}

export const TellIt = ({ pack, onTranscript, onTypeInstead, onAddDocuments }: TellItProps) => {
  const [take, setTake] = useState(0)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<"denied" | "silent" | "error" | null>(null)

  const handleStart = () => {
    setError(null)
    setTake((n) => n + 1)
    setRecording(true)
  }

  const handleError = (kind: "denied" | "silent" | "error") => {
    setRecording(false)
    setError(kind)
  }

  return (
    <div className="text-center">
      <h1 className="text-[25px] font-semibold tracking-[-.02em]">{pack.copy.tellIt.heading}</h1>
      <p className="mx-auto mb-10 mt-2.5 max-w-[460px] text-[14.5px] leading-relaxed text-on-surface-2">
        {pack.copy.tellIt.sub}
      </p>

      {error && (
        <p role="alert" className="mx-auto mb-8 max-w-[46ch] text-[14px] leading-relaxed text-red-fg">
          {ERROR_MESSAGES[error]}
        </p>
      )}

      <div className="mb-9 flex flex-col items-center gap-3">
        {recording ? (
          <Capture key={take} onDone={onTranscript} onError={handleError} />
        ) : (
          <>
            <button
              type="button"
              onClick={handleStart}
              aria-label="Start recording"
              className="focus-ring grid h-[84px] w-[84px] place-items-center rounded-full bg-accent-blue text-primary-foreground shadow-btn transition hover:bg-accent-blue-hover active:scale-[.96]"
            >
              <Mic className="size-[30px]" />
            </button>
            <p className="text-sm font-semibold">{error ? "Try again" : "Start talking"}</p>
            <p className="text-xs text-on-surface-3">A minute is plenty</p>
          </>
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-center gap-[22px] text-[13px]",
          recording && "invisible"
        )}
      >
        <button
          type="button"
          onClick={onTypeInstead}
          className="focus-ring flex items-center gap-2 rounded-md px-1 py-1 text-on-surface-2 transition-colors hover:text-accent-blue"
        >
          <Keyboard className="size-[15px] text-on-surface-3" />
          Type it instead
        </button>
        <button
          type="button"
          onClick={onAddDocuments}
          className="focus-ring flex items-center gap-2 rounded-md px-1 py-1 text-on-surface-2 transition-colors hover:text-accent-blue"
        >
          <Upload className="size-[15px] text-on-surface-3" />
          Add documents
        </button>
      </div>
    </div>
  )
}
