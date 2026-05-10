import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ARCHETYPE_CONFIG } from "./constants"
import { cn } from "@/lib/utils"

type TranscriptEntry = {
  speaker: string
  speakerName: string
  text: string
  timestamp: number
  type: string
}

type Character = {
  id: string
  archetypeId: string
}

type TranscriptPanelProps = {
  transcript: TranscriptEntry[]
  characters: Character[]
}

const formatTime = (ts: number, baseTs: number) => {
  const seconds = Math.floor((ts - baseTs) / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export const TranscriptPanel = ({ transcript, characters }: TranscriptPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const baseTs = transcript[0]?.timestamp ?? Date.now()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript.length])

  const getColor = (speakerId: string) => {
    const char = characters.find((c) => c.id === speakerId)
    if (!char) return { bg: "bg-gray-400", text: "text-gray-400" }
    const config = ARCHETYPE_CONFIG[char.archetypeId]
    return config
      ? { bg: config.bg, text: config.text }
      : { bg: "bg-gray-400", text: "text-gray-400" }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Live Transcript
        </span>
        <span className="text-[10px] text-muted-foreground">
          {transcript.length} turns
        </span>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {transcript.map((entry, i) => {
            const color = getColor(entry.speaker)
            return (
              <div key={i} className="flex gap-3">
                <div className={cn("mt-1 h-6 w-6 shrink-0 rounded-full flex items-center justify-center", color.bg)}>
                  <span className="text-[10px] font-medium text-white">
                    {entry.speakerName[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-xs font-semibold", color.text)}>
                      {entry.speakerName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(entry.timestamp, baseTs)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed">{entry.text}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
