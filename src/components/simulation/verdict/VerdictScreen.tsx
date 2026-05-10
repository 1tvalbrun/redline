"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type VerdictScreenProps = {
  simulationId: string
}

export const VerdictScreen = ({ simulationId }: VerdictScreenProps) => {
  const router = useRouter()
  const room = useQuery(api.rooms.getBySimulation, {
    simulationId: simulationId as Id<"simulations">,
  })

  if (!room) return <p className="text-muted-foreground">Loading...</p>
  if (!room.verdict) return <p className="text-muted-foreground">No verdict yet.</p>

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Panel Verdict</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="default" className="text-lg px-4 py-1">
            {room.verdict.decision ?? "Pending"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {room.verdict.summary ?? "The panel has concluded their assessment."}
          </p>
        </CardContent>
      </Card>

      <Button onClick={() => router.push(`/simulation/${simulationId}/report`)}>
        View Full Report
      </Button>
    </div>
  )
}
