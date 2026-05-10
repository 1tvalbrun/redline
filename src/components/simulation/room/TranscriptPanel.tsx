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

export const TranscriptPanel = ({ transcript }: TranscriptPanelProps) => {
  if (transcript.length === 0) {
    return (
      <div className="flex-1 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Transcript will appear here as the panel speaks...
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 rounded-lg border border-border p-4">
      <div className="space-y-3">
        {transcript.map((entry, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-medium text-primary">
              {entry.speakerName}
            </p>
            <p className="text-sm">{entry.text}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
