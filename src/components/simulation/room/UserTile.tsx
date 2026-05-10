"use client"

import { useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"

type UserTileProps = {
  userName: string
  simulationName: string
}

export const UserTile = ({ userName, simulationName }: UserTileProps) => {
  const [isMuted, setIsMuted] = useState(true)

  const handleToggleMute = () => setIsMuted((prev) => !prev)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex aspect-square items-center justify-center rounded-xl bg-[#1C1C1E]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
          <span className="text-lg font-light text-white/40">
            {userName[0]}
          </span>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium">{userName}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Founder · {simulationName}
        </p>
      </div>
      <Button
        size="sm"
        variant={isMuted ? "destructive" : "secondary"}
        className="w-full gap-2 text-xs"
        onClick={handleToggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        {isMuted ? "Unmute" : "Mute"}
      </Button>
    </div>
  )
}
