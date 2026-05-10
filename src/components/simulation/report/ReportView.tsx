"use client"

import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { GeneratedMediaCard } from "./GeneratedMediaCard"

type ReportViewProps = {
  simulationId: string
}

export const ReportView = ({ simulationId }: ReportViewProps) => {
  const report = useQuery(api.reports.getBySimulation, {
    simulationId: simulationId as Id<"simulations">,
  })

  if (!report) return <p className="text-muted-foreground">Loading report...</p>

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Simulation Report" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Overall Score
            <Badge variant="default" className="text-lg px-3">
              {report.overallScore}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium">Verdict</h3>
            <p className="text-sm text-muted-foreground">{report.verdict}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium">Executive Summary</h3>
            <p className="text-sm text-muted-foreground">{report.executiveSummary}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Risks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-4">
            {report.topRisks.map((risk, i) => (
              <li key={i} className="text-sm text-muted-foreground">{risk}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-4">
            {report.opportunities.map((opp, i) => (
              <li key={i} className="text-sm text-muted-foreground">{opp}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {report.generatedMedia && (
        <GeneratedMediaCard media={report.generatedMedia} status={report.mediaStatus} />
      )}
    </div>
  )
}
