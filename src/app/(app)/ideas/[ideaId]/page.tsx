"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { deriveReadiness, INVESTOR_READY_LINE } from "@/lib/readiness"
import { deriveTrajectory } from "@/lib/trajectory"
import { formatAgo, formatDay } from "@/lib/utils"
import { useNow } from "@/lib/useNow"
import { Panel } from "@/components/shared/Panel"
import { TrajectoryChart } from "@/components/workspace/TrajectoryChart"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"
import { WORKSPACE_CTA } from "@/components/workspace/cta"

const IdeaDetailPage = ({ params }: { params: Promise<{ ideaId: string }> }) => {
  const { ideaId } = use(params)
  const detail = useQuery(api.ideas.getDetail, { ideaId: ideaId as Id<"ideas"> })
  const nowMs = useNow()

  if (detail === undefined) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-80 animate-pulse bg-surface-2" />
        <div className="h-56 w-full animate-pulse bg-surface-2" />
      </div>
    )
  }

  if (detail === null) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        This idea doesn&apos;t exist.{" "}
        <Link href="/ideas" className="focus-ring underline hover:text-red-fg">
          Back to ideas
        </Link>
        .
      </p>
    )
  }

  const readiness = deriveReadiness(detail.latestRiskScores ?? undefined)
  const trajectory = deriveTrajectory(detail.runs)
  const lastVerdict = [...detail.runs].reverse().find((run) => run.verdict !== null)
  // openQuestions arrives as one prose blob; split it back into questions.
  const openQuestions =
    detail.openQuestions
      ?.split("?")
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) => `${q}?`) ?? []

  return (
    <div>
      <Link
        href="/"
        className="focus-ring mb-[18px] flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-2 hover:text-red-fg"
      >
        ← Back to overview
      </Link>

      <div className="flex items-start justify-between gap-6 max-md:flex-col">
        <div>
          <h1 className="font-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-none tracking-[-.02em]">
            {detail.name}
          </h1>
          <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-3">
            {[detail.stage, detail.businessModel].filter(Boolean).join(" · ") || "Not yet briefed"} ·{" "}
            {detail.runs.length} {detail.runs.length === 1 ? "run" : "runs"} · last run{" "}
            {formatAgo(detail.lastRunAt, nowMs)}
          </p>
        </div>
        <div className="text-right">
          {lastVerdict?.verdict && <VerdictBadge decision={lastVerdict.verdict} className="px-[11px] py-[5px] text-[11px] tracking-[.12em]" />}
          <p className="mt-3 font-display text-[42px] font-extrabold leading-none tracking-[-.03em] tabular-nums">
            {readiness.overall ?? "—"}
            <span className="text-base text-on-surface-3">/100</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[.1em] text-on-surface-3">
            {readiness.overall === null
              ? "No scored runs yet"
              : readiness.overall >= INVESTOR_READY_LINE
                ? "Clear of the investor-ready line"
                : `${INVESTOR_READY_LINE - readiness.overall} below the ready line`}
          </p>
        </div>
      </div>

      <div className="mt-7 grid items-start gap-[26px] md:grid-cols-[1.15fr_1fr]">
        <div>
          <Panel title="Readiness over runs" meta={`target ${INVESTOR_READY_LINE}`}>
            <TrajectoryChart points={trajectory} />
          </Panel>

          <Panel title="Run history" meta="verdict · score" className="mt-[22px]">
            {detail.runs.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-2">No runs yet.</p>
            ) : (
              <ul>
                {[...detail.runs].reverse().map((run) => (
                  <li
                    key={run.simulationId}
                    className="grid grid-cols-[64px_1fr_50px_80px] items-center gap-3 border-t border-line py-[11px] first:border-t-0 first:pt-0"
                  >
                    <span className="font-mono text-[11px] text-on-surface-3">{formatDay(run.at)}</span>
                    <span>
                      {run.verdict ? (
                        <VerdictBadge decision={run.verdict} />
                      ) : (
                        <span className="font-mono text-[9px] uppercase tracking-[.08em] text-on-surface-3">
                          Unscored
                        </span>
                      )}
                    </span>
                    <span className="text-right font-display text-base font-bold tabular-nums">
                      {run.score ?? "—"}
                    </span>
                    <span className="truncate text-right font-mono text-[9.5px] uppercase text-on-surface-3">
                      {run.panelist ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Open risks" meta="from the last verdict">
            {detail.topRisks.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-2">
                No verdicts yet. Risks appear after the first scored run.
              </p>
            ) : (
              <ul>
                {detail.topRisks.map((risk, i) => (
                  <li
                    key={i}
                    className="flex gap-[11px] border-t border-line py-[11px] text-[13px] leading-[1.5] text-on-surface-2 first:border-t-0 first:pt-0"
                  >
                    <span aria-hidden="true" className="flex-none font-mono font-semibold text-red-fg">
                      ✕
                    </span>
                    <span className="sr-only">Risk: </span>
                    {risk}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3.5 border-t border-line pt-3 font-mono text-[9.5px] italic tracking-[.06em] text-on-surface-3">
              The full gap map, cited from your materials, arrives with ingest.
            </p>
          </Panel>

          {openQuestions.length > 0 && (
            <Panel title="Open questions" meta="from the brief read" className="mt-[22px]">
              <ul>
                {openQuestions.map((question, i) => (
                  <li
                    key={i}
                    className="flex gap-[11px] border-t border-line py-[11px] text-[13px] leading-[1.5] text-on-surface-2 first:border-t-0 first:pt-0"
                  >
                    <span aria-hidden="true" className="flex-none font-mono font-semibold text-red-fg">
                      ?
                    </span>
                    <span className="sr-only">Open question: </span>
                    {question}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="mt-6 flex items-center gap-3">
            <Link href="/simulation/new" className={WORKSPACE_CTA}>
              Close the gaps · re-run <span aria-hidden="true">→</span>
            </Link>
            <span className="font-mono text-[11px] uppercase text-on-surface-3">~12 min</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IdeaDetailPage
