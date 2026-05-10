import { ScrollArea } from "@/components/ui/scroll-area"
import { NOTE_BORDER_COLORS } from "./constants"

type Note = {
  type: string
  text: string
  timestamp: number
}

type LiveNotesProps = {
  notes: Note[]
}

const formatTimestamp = (ts: number) => {
  const d = new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
}

export const LiveNotes = ({ notes }: LiveNotesProps) => {
  return (
    <div className="flex flex-1 flex-col rounded-xl border border-border bg-card p-4">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Live Notes
      </span>
      <ScrollArea className="mt-3 flex-1">
        <div className="space-y-2">
          {notes.map((note, i) => (
            <div
              key={i}
              className={`rounded-r-lg border-l-2 bg-muted/50 px-3 py-2 ${NOTE_BORDER_COLORS[note.type] ?? "border-l-gray-400"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {note.type.replace("_", " ")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · {formatTimestamp(note.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed">{note.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="mt-3 text-[10px] italic text-muted-foreground">
        AI-generated observations. Review critically.
      </p>
    </div>
  )
}
