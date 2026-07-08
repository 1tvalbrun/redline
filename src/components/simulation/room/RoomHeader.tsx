import { useEffect, useState } from "react"
import { Pause, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type RoomHeaderProps = {
  simulationName: string
  round: string
  startedAt: number
  onEndSession: () => void
}

const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export const RoomHeader = ({
  simulationName,
  round,
  startedAt,
  onEndSession,
}: RoomHeaderProps) => {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt)
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const elapsedTime = formatElapsed(elapsed)
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-sm bg-foreground" />
        <span className="font-display text-sm font-semibold">Redline</span>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {simulationName}
        </span>
        <span className="text-xs text-muted-foreground">FOUNDER ROOM</span>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide">
          {round}
        </Badge>
        <span className="font-mono text-sm text-muted-foreground">{elapsedTime}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-500">RECORDING</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Pause">
          <Pause className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="text-xs"
          onClick={onEndSession}
        >
          End session
        </Button>
      </div>
    </header>
  )
}
