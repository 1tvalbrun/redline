"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Waveform, SELF_WAVE_DELAYS } from "./Waveform"

export type MicState = "live" | "muted" | "blocked" | "ended"

const MIC_LABELS: Record<MicState, { button: string; aria: string }> = {
  live: { button: "Mute", aria: "Mute microphone" },
  muted: { button: "Unmute", aria: "Unmute microphone" },
  blocked: { button: "Mic blocked", aria: "Microphone blocked by browser permissions" },
  ended: { button: "Mute", aria: "Session ended" },
}

type CameraState = "starting" | "ready" | "off"

type UserTileProps = {
  userName: string
  micState: MicState
  onToggleMic: () => void
}

export const UserTile = ({ userName, micState, onToggleMic }: UserTileProps) => {
  const [cameraState, setCameraState] = useState<CameraState>("starting")
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          setCameraState("ready")
        }
      })
      .catch(() => setCameraState("off"))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const micDisabled = micState === "blocked" || micState === "ended"

  return (
    <div>
      <section
        aria-label="Your camera"
        className="relative aspect-[4/3] overflow-hidden border border-line-2 bg-[linear-gradient(165deg,#3a352e,#1a1713)]"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        {cameraState !== "ready" && (
          <p className="absolute inset-0 flex items-center justify-center font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface-2">
            {cameraState === "starting" ? "Camera starting…" : "Camera off"}
          </p>
        )}
        <span className="absolute bottom-2 left-[9px] z-[2] font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">
          You · {userName}
        </span>
        <Waveform
          active={micState === "live"}
          delays={SELF_WAVE_DELAYS}
          barClassName="w-[2px] bg-ok-fg"
          className="absolute bottom-[9px] right-[9px] z-[2] h-3 gap-[2px]"
        />
      </section>
      <button
        type="button"
        onClick={onToggleMic}
        disabled={micDisabled}
        aria-label={MIC_LABELS[micState].aria}
        className={`focus-ring mt-3 flex w-full items-center justify-center gap-[9px] border p-[10px] font-mono text-[11px] uppercase tracking-[.08em] transition-colors hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent ${
          micState === "blocked"
            ? "border-red-fg text-red-fg"
            : "border-line-2 text-on-surface"
        }`}
      >
        {micState === "live" ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        {MIC_LABELS[micState].button}
      </button>
    </div>
  )
}
