import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatElapsed } from "@/lib/utils"

// Marker glyph + color per orchestrator note type. Meaning is carried by
// glyph and sr-only label, never color alone.
const NOTE_MARKERS: Record<string, { glyph: string; className: string; label: string }> = {
  strong_answer: { glyph: "✓", className: "text-ok-fg", label: "Strong answer" },
  weak_assumption: { glyph: "⚠", className: "text-amber-fg", label: "Weak assumption" },
  objection: { glyph: "✕", className: "text-red-fg", label: "Objection" },
  follow_up: { glyph: "?", className: "text-amber-fg", label: "Follow-up" },
  event: { glyph: "→", className: "text-on-surface-2", label: "Event" },
}

const FALLBACK_MARKER = { glyph: "·", className: "text-on-surface-2", label: "Note" }

type Note = {
  type: string
  text: string
  timestamp: number
}

type LiveNotesProps = {
  notes: Note[]
  startedAt: number
}

export const LiveNotes = ({ notes, startedAt }: LiveNotesProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [notes.length])

  return (
    <section aria-label="Live notes" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center justify-between px-[18px] pb-3 pt-[15px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
          Live notes
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[.06em] tabular-nums text-on-surface-2">
          {notes.length}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-[18px]">
        {notes.length === 0 ? (
          <p className="py-[11px] text-[12.5px] leading-relaxed text-on-surface-2">
            Observations will appear here as the panel reacts.
          </p>
        ) : (
          <div role="log" aria-label="Panel observations">
            {notes.map((note, i) => {
              const marker = NOTE_MARKERS[note.type] ?? FALLBACK_MARKER
              return (
                <div
                  key={i}
                  className="flex gap-[10px] border-t border-line py-[11px] first:border-t-0"
                >
                  <span
                    aria-hidden="true"
                    className={`flex-none font-mono text-[13px] font-semibold leading-[1.4] ${marker.className}`}
                  >
                    {marker.glyph}
                  </span>
                  <div className="text-[12.5px] leading-normal text-on-surface-2">
                    <span className="sr-only">{marker.label}: </span>
                    {note.text}
                    <span className="mt-[3px] block font-mono text-[9px] tracking-[.06em] tabular-nums">
                      {formatElapsed(startedAt, note.timestamp)}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
      <p className="flex-none border-t border-line px-[18px] py-3 font-mono text-[9.5px] italic tracking-[.06em] text-on-surface-2">
        AI-generated observations. Review critically.
      </p>
    </section>
  )
}
