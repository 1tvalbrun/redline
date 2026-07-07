"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"

type UserTileProps = {
  userName: string
  simulationName: string
  isMicEnabled: boolean
  onToggleMic: () => void
}

export const UserTile = ({
  userName,
  simulationName,
  isMicEnabled,
  onToggleMic,
}: UserTileProps) => {
  const [cameraReady, setCameraReady] = useState(false)
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
          setCameraReady(true)
        }
      })
      .catch(() => setCameraReady(false))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])


  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#1C1C1E]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        {!cameraReady && (
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
            <span className="text-lg font-light text-white/40">
              {userName[0]}
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium">{userName}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Founder · {simulationName}
        </p>
      </div>
      <Button
        size="sm"
        variant={isMicEnabled ? "secondary" : "destructive"}
        className="w-full gap-2 text-xs"
        onClick={onToggleMic}
        aria-label={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isMicEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        {isMicEnabled ? "Mute" : "Unmute"}
      </Button>
    </div>
  )
}
