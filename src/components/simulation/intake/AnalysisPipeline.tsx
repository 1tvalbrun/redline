"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

const STATUS_PROGRESS: Record<string, number> = {
  draft: 10,
  analyzing: 60,
  ready: 100,
}

type AnalysisPipelineProps = {
  simulationId: string
}

export const AnalysisPipeline = ({ simulationId }: AnalysisPipelineProps) => {
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })

  const progress = STATUS_PROGRESS[simulation?.status ?? "draft"] ?? 0

  return (
    <Card className="max-w-lg">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {simulation?.status === "analyzing" && "Analyzing your brief..."}
            {simulation?.status === "draft" && "Starting analysis..."}
            {simulation?.status === "ready" && "Analysis complete!"}
          </p>
          <Progress value={progress} />
        </div>
        {simulation?.status === "ready" ? (
          <Link href={`/simulation/${simulationId}/panel`}>
            <Button>Continue to Panel Setup</Button>
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            Extracting problem space, assumptions, and risk vectors from your brief.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
