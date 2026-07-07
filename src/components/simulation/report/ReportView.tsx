"use client"

import Image from "next/image"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ReportViewProps = {
  simulationId: string
}

const VERDICT_LABELS: Record<string, string> = {
  advance: "ADVANCE",
  iterate: "ITERATE",
  pass: "PASS",
}

const VERDICT_BADGE: Record<string, string> = {
  advance: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  iterate: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  pass: "border-red-500/40 bg-red-500/10 text-red-700",
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
}

const Shimmer = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
)

export const ReportView = ({ simulationId }: ReportViewProps) => {
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })
  const report = useQuery(api.reports.getBySimulation, {
    simulationId: simulationId as Id<"simulations">,
  })

  const heroUrl =
    report?.generatedMedia?.successVideo ?? report?.generatedMedia?.failureVideo
  const heroReady = report?.mediaStatus === "complete" && !!heroUrl
  const mediaStatus = report?.mediaStatus ?? ""
  const heroFailed =
    mediaStatus.startsWith("failed") || mediaStatus === "skipped"
  const heroErrorReason = heroFailed && mediaStatus.startsWith("failed: ")
    ? mediaStatus.slice("failed: ".length)
    : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-rose-100 to-purple-100">
        {heroReady ? (
          <Image
            src={heroUrl!}
            alt="Generated scene"
            fill
            className="object-cover animate-in fade-in duration-700"
            unoptimized
          />
        ) : heroFailed ? (
          heroErrorReason ? (
            <div className="absolute inset-x-4 bottom-4 rounded-md bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
              <span className="font-medium text-foreground">Image generation failed:</span>{" "}
              {heroErrorReason}
            </div>
          ) : null
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
              <p className="text-sm text-foreground/70">
                {report ? "Generating scene…" : "Synthesizing report…"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {report ? (
            <>
              <span
                className={`inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${
                  VERDICT_BADGE[report.verdict] ?? VERDICT_BADGE.iterate
                }`}
              >
                {VERDICT_LABELS[report.verdict] ?? report.verdict.toUpperCase()}
              </span>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                {simulation?.brief.ideaName ?? "Simulation"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Founder Room · {simulation?.brief.stage ?? ""}
              </p>
            </>
          ) : (
            <>
              <Shimmer className="h-6 w-24 rounded-full" />
              <Shimmer className="mt-3 h-9 w-72" />
              <Shimmer className="mt-2 h-4 w-32" />
            </>
          )}
        </div>
        {report ? (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Overall
            </p>
            <p className="font-display text-4xl font-bold tabular-nums">
              {report.overallScore}
              <span className="text-xl text-muted-foreground">/100</span>
            </p>
          </div>
        ) : (
          <Shimmer className="h-16 w-24" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <p className="text-sm leading-relaxed">{report.executiveSummary}</p>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-2/3" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Panel Verdict</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.panelVerdicts[0] ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {report.panelVerdicts[0].characterName}
                  </p>
                  <p className="text-xs italic text-muted-foreground">
                    {report.panelVerdicts[0].verdict}
                  </p>
                </div>
                <p className="text-2xl font-semibold tabular-nums shrink-0">
                  {report.panelVerdicts[0].score}
                  <span className="text-sm text-muted-foreground">/100</span>
                </p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {report.panelVerdicts[0].reasoning}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-5 w-48" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Risks</CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <ul className="space-y-2">
                {report.topRisks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-red-500">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-3/4" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <ul className="space-y-2">
                {report.opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-500">•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-3/4" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <ol className="space-y-3">
              {report.nextSevenDays.map((d, i) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="w-14 shrink-0 font-semibold tabular-nums text-muted-foreground">
                    Day {d.day}
                  </span>
                  <span className="flex-1">{d.task}</span>
                  <span
                    className={`text-[10px] uppercase tracking-widest ${
                      PRIORITY_COLOR[d.priority] ?? "text-muted-foreground"
                    }`}
                  >
                    {d.priority}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-3/4" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
