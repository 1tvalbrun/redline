import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

type TranscriptEntry = {
  speaker: string
  speakerName: string
  text: string
  timestamp: number
  type: string
}

type TranscriptPanelProps = {
  transcript: TranscriptEntry[]
}

const formatTime = (ts: number, baseTs: number) => {
  const seconds = Math.max(0, Math.floor((ts - baseTs) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export const TranscriptPanel = ({ transcript }: TranscriptPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const baseTs = transcript[0]?.timestamp ?? Date.now()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [transcript.length])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Live Transcript
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {transcript.length} turns
        </span>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {transcript.map((entry, i) => {
            const isUser = entry.type === "user"
            return (
              <div
                key={i}
                className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
              >
                <div
                  className={`mt-1 h-6 w-6 shrink-0 rounded-full flex items-center justify-center ${
                    isUser ? "bg-muted-foreground/40" : "bg-primary"
                  }`}
                >
                  <span className="text-[10px] font-medium text-white">
                    {entry.speakerName[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isUser ? "text-muted-foreground" : "text-primary"
                      }`}
                    >
                      {entry.speakerName}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
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
