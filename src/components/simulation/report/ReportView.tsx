"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { INVESTOR_READY_LINE } from "@/lib/readiness"
import { Panel } from "@/components/shared/Panel"
import { ReadinessGauge, useCountUp } from "@/components/shared/ReadinessGauge"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"
import { VerdictStage } from "./VerdictStage"

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  advance: { label: "Advance", className: "border-ok text-ok" },
  iterate: { label: "Iterate", className: "border-amber-fg text-amber-fg" },
  pass: { label: "Pass", className: "border-red text-red-fg" },
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-fg",
  medium: "text-amber-fg",
  low: "text-ok",
}

const Shimmer = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-surface-2", className)} />
)

type ReportViewProps = {
  simulationId: string
}

export const ReportView = ({ simulationId }: ReportViewProps) => {
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })
  const report = useQuery(api.reports.getBySimulation, {
    simulationId: simulationId as Id<"simulations">,
  })
  const ideaDetail = useQuery(
    api.ideas.getDetail,
    simulation?.ideaId ? { ideaId: simulation.ideaId } : "skip"
  )
  const displayedScore = useCountUp(report ? report.overallScore : null)

  const previousScore = (() => {
    if (!report || !ideaDetail) return null
    const earlierScored = ideaDetail.runs.filter(
      (run) => run.simulationId !== simulationId && run.at < report._creationTime && run.score !== null
    )
    return earlierScored.length > 0 ? earlierScored[earlierScored.length - 1].score : null
  })()

  const verdict = report ? VERDICT_STYLE[report.verdict] ?? VERDICT_STYLE.iterate : null
  const panelVerdict = report?.panelVerdicts[0]

  if (simulation === null) return <IdeaNotFound />

  return (
    <div>
      <StageKicker>
        The debrief{panelVerdict ? ` · ${panelVerdict.characterName}` : ""}
      </StageKicker>

      <div className="flex items-start justify-between gap-[30px] max-md:flex-col">
        <div className="min-w-0">
          {report ? (
            <span
              className={cn(
                "inline-block border px-3.5 py-[7px] font-mono text-xs uppercase tracking-[.16em]",
                verdict?.className
              )}
            >
              {verdict?.label}
            </span>
          ) : (
            <Shimmer className="h-8 w-24" />
          )}
          <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
            {simulation?.brief.ideaName ?? "Your idea"}
          </h1>
          {report ? (
            <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
              {report.executiveSummary}
            </p>
          ) : (
            <div className="mt-3.5 max-w-[52ch] space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-2/3" />
              <p className="pt-1 font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-3">
                Synthesizing the verdict…
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-none items-center gap-5">
          <ReadinessGauge value={report ? report.overallScore : null} className="h-[140px] w-[200px]" />
          <div>
            <p className="font-display text-[54px] font-extrabold leading-none tracking-[-.03em] tabular-nums">
              {displayedScore ?? "—"}
            </p>
            {report && previousScore !== null && report.overallScore !== previousScore && (
              <p
                className={cn(
                  "mt-1.5 font-mono text-xs uppercase tracking-[.06em]",
                  report.overallScore > previousScore ? "text-ok" : "text-red-fg"
                )}
              >
                {report.overallScore > previousScore ? "▲ up" : "▼ down"}{" "}
                {Math.abs(report.overallScore - previousScore)} from the last run
              </p>
            )}
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[.1em] text-on-surface-3">
              {report
                ? report.overallScore >= INVESTOR_READY_LINE
                  ? "clear of the investor-ready line"
                  : `${INVESTOR_READY_LINE - report.overallScore} below the investor-ready line`
                : "score arrives with the verdict"}
            </p>
          </div>
        </div>
      </div>

      <VerdictStage
        className="mt-8"
        video={report ? report.verdictVideo ?? null : undefined}
        pendingSince={report?._creationTime}
        ideaName={simulation?.brief.ideaName ?? "Your idea"}
        verdictLabel={verdict?.label ?? null}
      />

      <div className="mt-[26px] grid gap-[26px] max-md:grid-cols-1 md:grid-cols-2">
        <Panel title="In the room">
          {report ? (
            <div>
              {report.opportunities.length === 0 && (
                <div className="flex gap-[11px] border-t border-line py-[11px] text-[13.5px] leading-[1.5] text-on-surface-2 first:border-t-0">
                  <span aria-hidden="true" className="flex-none font-mono font-semibold">
                    ○
                  </span>
                  <span>
                    Nothing held up. The panel heard no claim that survived
                    pressure.
                  </span>
                </div>
              )}
              {report.opportunities.map((text, i) => (
                <div key={`ok-${i}`} className="flex gap-[11px] border-t border-line py-[11px] text-[13.5px] leading-[1.5] first:border-t-0">
                  <span aria-hidden="true" className="flex-none font-mono font-semibold text-ok">✓</span>
                  <span><span className="sr-only">Held up: </span>{text}</span>
                </div>
              ))}
              {report.topRisks.map((text, i) => (
                <div key={`bad-${i}`} className="flex gap-[11px] border-t border-line py-[11px] text-[13.5px] leading-[1.5] first:border-t-0">
                  <span aria-hidden="true" className="flex-none font-mono font-semibold text-red-fg">✕</span>
                  <span><span className="sr-only">Broke: </span>{text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          )}
        </Panel>

        <Panel title="Fix before you re-run · 7-day plan">
          {report ? (
            <div>
              {report.nextSevenDays.map((d, i) => (
                <div key={i} className="flex gap-[13px] border-t border-line py-3 first:border-t-0">
                  <span aria-hidden="true" className="flex-none font-display text-[15px] font-extrabold text-red-fg">
                    {String(d.day).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      <span className="sr-only">Day {d.day}: </span>
                      {d.task}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-none font-mono text-[10px] uppercase tracking-[.1em]",
                      PRIORITY_COLOR[d.priority] ?? "text-on-surface-2"
                    )}
                  >
                    {d.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-3/4" />
            </div>
          )}
        </Panel>

        <Panel title="The panel's word" className="md:col-span-2">
          {panelVerdict ? (
            <div className="flex items-baseline justify-between gap-6 max-md:flex-col">
              <div className="min-w-0">
                <p className="font-display text-[19px] font-bold tracking-[-.01em]">
                  {panelVerdict.characterName}
                </p>
                <p className="mt-[2px] text-xs italic text-on-surface-2">
                  &ldquo;{panelVerdict.verdict}&rdquo;
                </p>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-on-surface-2">
                  {panelVerdict.reasoning}
                </p>
              </div>
              <p className="flex-none font-display text-[28px] font-extrabold tracking-[-.02em] tabular-nums">
                {panelVerdict.score}
                <span className="text-[15px] text-on-surface-3">/100</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Shimmer className="h-5 w-48" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          )}
        </Panel>

      </div>

      <div className="mt-[30px] flex flex-wrap items-center gap-3.5">
        <Link href="/simulation/new" className={FLOW_BTN}>
          Close the gaps · re-run <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/home"
          className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
        >
          Back to overview
        </Link>
      </div>
    </div>
  )
}
