import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatElapsed } from "@/lib/utils"
import type { TranscriptEntry } from "@/types/panel"

type TranscriptPanelProps = {
  transcript: TranscriptEntry[]
  startedAt: number
}

export const TranscriptPanel = ({ transcript, startedAt }: TranscriptPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [transcript.length])

  return (
    <section
      aria-label="Live transcript"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-none items-center justify-between px-[18px] pb-3 pt-[15px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
          Live transcript
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.06em] tabular-nums text-on-surface-2">
          {transcript.length} turns
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-[18px] pb-4">
        {transcript.length === 0 ? (
          <p className="py-[11px] text-[12.5px] leading-relaxed text-on-surface-2">
            Your conversation will appear here as you speak.
          </p>
        ) : (
          <div>
            {transcript.map((entry, i) => {
              const isUser = entry.type === "user"
              return (
                <div
                  key={i}
                  className="border-t border-line py-[11px] first:border-t-0"
                >
                  <div
                    className={`mb-[5px] flex justify-between font-mono text-[9.5px] uppercase tracking-[.12em] ${
                      isUser ? "text-on-surface-2" : "text-red-fg"
                    }`}
                  >
                    <span>{entry.speakerName}</span>
                    <span className="tracking-[.04em] tabular-nums text-on-surface-2">
                      {formatElapsed(startedAt, entry.timestamp)}
                    </span>
                  </div>
                  <p
                    className={`text-[13.5px] leading-normal ${
                      isUser ? "text-on-surface-2" : "text-on-surface"
                    }`}
                  >
                    {entry.text}
                  </p>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
