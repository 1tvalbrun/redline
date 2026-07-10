import { useRef, useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatElapsed } from "@/lib/utils"
import { bySpokenTime, spokenTime } from "@/lib/transcript"
import type { TranscriptEntry } from "@/types/panel"

type TranscriptPanelProps = {
  transcript: TranscriptEntry[]
  startedAt: number
  // Display-only hold on the founder's finalized turns: a "user" entry is
  // revealed once it has been written for this many ms, matching the
  // avatar's inherent transcript lag so both sides land at one cadence.
  // Omit (session replay, concluded rooms) to show everything at once.
  delayUserMs?: number
}

const isRevealed = (
  entry: TranscriptEntry,
  delayUserMs: number | undefined,
  now: number
) =>
  delayUserMs === undefined ||
  entry.type !== "user" ||
  entry.timestamp + delayUserMs <= now

export const TranscriptPanel = ({
  transcript,
  startedAt,
  delayUserMs,
}: TranscriptPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  // The reveal clock: renders filter against this state, and the timer
  // advances it when the earliest held entry becomes due. Timer cleanup
  // keeps a late release from firing after unmount.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (delayUserMs === undefined) return
    // Anything the last render held back (judged against the state clock)
    // gets a timer to its due moment, measured against real time — entries
    // already due fire on the next tick.
    const heldReveals = transcript
      .filter((entry) => !isRevealed(entry, delayUserMs, now))
      .map((entry) => entry.timestamp + delayUserMs)
    if (heldReveals.length === 0) return
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(...heldReveals) - Date.now()) + 20
    )
    return () => clearTimeout(timer)
  }, [transcript, delayUserMs, now])

  // Entries are stored in arrival order, which is not speech order (an
  // avatar turn's final arrives only when her next turn starts) — render
  // order derives from measured speech time.
  const visible = bySpokenTime(
    transcript.filter((entry) => isRevealed(entry, delayUserMs, now))
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [visible.length])

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
          {visible.length} turns
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-[18px] pb-4">
        {visible.length === 0 ? (
          <p className="py-[11px] text-[12.5px] leading-relaxed text-on-surface-2">
            Your conversation will appear here as you speak.
          </p>
        ) : (
          <div aria-live="polite">
            {visible.map((entry) => {
              const isUser = entry.type === "user"
              return (
                <div
                  key={`${entry.timestamp}-${entry.speaker}`}
                  className="border-t border-line py-[11px] first:border-t-0"
                >
                  <div
                    className={`mb-[5px] flex justify-between font-mono text-[9.5px] uppercase tracking-[.12em] ${
                      isUser ? "text-on-surface-2" : "text-red-fg"
                    }`}
                  >
                    <span>{entry.speakerName}</span>
                    <span className="tracking-[.04em] tabular-nums text-on-surface-2">
                      {formatElapsed(startedAt, spokenTime(entry))}
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
