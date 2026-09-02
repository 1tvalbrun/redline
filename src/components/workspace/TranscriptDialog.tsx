"use client"

import { FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

type TranscriptEntry = {
  type: "user" | "panelist"
  speakerName: string
  text: string
}

// Its own component so the scrollbar hook's mount effect runs when the
// dialog opens — the portal mounts this fresh per open, after the scroll
// container exists.
const TranscriptTurns = ({ transcript }: { transcript: TranscriptEntry[] }) => {
  const scrollRef = useAutoHideScrollbar<HTMLDivElement>()
  return (
    <div
      ref={scrollRef}
      className="scrollbar-subtle min-h-0 space-y-4 overflow-y-auto overscroll-contain px-6 py-5 max-md:px-4"
    >
      {transcript.map((entry, i) => (
        <div key={i}>
          <p
            className={cn(
              "mb-0.5 text-[10.5px] font-semibold uppercase tracking-[.08em]",
              entry.type === "user" ? "text-accent-blue" : "text-on-surface-3"
            )}
          >
            {entry.speakerName}
          </p>
          <p
            className={cn(
              "break-words text-[13px] leading-relaxed text-on-surface-2",
              entry.type === "panelist" && "font-serif text-sm italic text-on-surface"
            )}
          >
            {entry.text}
          </p>
        </div>
      ))}
    </div>
  )
}

export const TranscriptDialog = ({
  transcript,
  personaName,
}: {
  transcript: TranscriptEntry[]
  personaName: string
}) => {
  if (transcript.length === 0) return null
  const turnCount = `${transcript.length} ${transcript.length === 1 ? "turn" : "turns"}`
  return (
    <Dialog>
      <DialogTrigger className="focus-ring flex items-center gap-1.5 rounded-lg border border-dashed border-accent-line px-2.5 py-1.5 text-[13px] text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-accent-blue max-md:py-2.5">
        <FileText className="size-3.5" />
        Transcript · {turnCount}
      </DialogTrigger>
      <DialogContent className="flex max-h-[80dvh] w-[calc(100%-2.5rem)] max-w-[680px] flex-col">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <DialogTitle className="text-[15px] font-semibold">The transcript</DialogTitle>
            <DialogDescription className="mt-0.5 text-[12.5px] text-on-surface-3">
              Session with {personaName} · {turnCount}
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Close"
            className="focus-ring -mr-2 -mt-1 grid place-items-center rounded-lg p-1.5 text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface max-md:p-3"
          >
            <X className="size-[15px]" />
          </DialogClose>
        </div>
        <TranscriptTurns transcript={transcript} />
      </DialogContent>
    </Dialog>
  )
}
