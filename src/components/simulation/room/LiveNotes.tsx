import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

const NOTE_BORDER_COLORS: Record<string, string> = {
  follow_up: "border-l-blue-500",
  event: "border-l-amber-500",
  strong_answer: "border-l-emerald-500",
  weak_assumption: "border-l-orange-500",
  objection: "border-l-red-500",
}

type Note = {
  type: string
  text: string
  timestamp: number
}

type LiveNotesProps = {
  notes: Note[]
  startedAt?: number
}

const formatRelative = (ts: number, baseTs: number) => {
  const seconds = Math.max(0, Math.floor((ts - baseTs) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export const LiveNotes = ({ notes, startedAt }: LiveNotesProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const baseTs = startedAt ?? notes[0]?.timestamp ?? Date.now()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [notes.length])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Live Notes
      </span>
      <ScrollArea className="mt-3 flex-1">
        <div className="space-y-2">
          {notes.map((note, i) => (
            <div
              key={i}
              className={`rounded-r-lg border-l-2 bg-muted/50 px-3 py-2 animate-in fade-in-0 slide-in-from-right-1 duration-300 ${
                NOTE_BORDER_COLORS[note.type] ?? "border-l-gray-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {note.type.replace("_", " ")}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  · {formatRelative(note.timestamp, baseTs)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed">{note.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <p className="mt-3 text-[10px] italic text-muted-foreground">
        AI-generated observations. Review critically.
      </p>
    </div>
  )
}
