import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Note = {
  type: string
  text: string
  timestamp: number
}

type LiveNotesProps = {
  notes: Note[]
}

export const LiveNotes = ({ notes }: LiveNotesProps) => {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Live Notes</CardTitle>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            AI-generated notes will appear here...
          </p>
        ) : (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {notes.map((note, i) => (
                <div key={i} className="space-y-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {note.type}
                  </Badge>
                  <p className="text-xs">{note.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
