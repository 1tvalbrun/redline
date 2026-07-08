"use client"

import Link from "next/link"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import {
  deriveReadiness,
  readinessSeverity,
  AXIS_LABELS,
  INVESTOR_READY_LINE,
  type ReadinessSeverity,
} from "@/lib/readiness"
import { deriveTrajectory, type TrajectoryPoint } from "@/lib/trajectory"
import { cn, formatAgo } from "@/lib/utils"
import { useNow } from "@/lib/useNow"

export type IdeaStats = FunctionReturnType<typeof api.ideas.listWithStats>[number]

const SEVERITY_BG: Record<ReadinessSeverity, string> = {
  bad: "bg-red",
  warn: "bg-amber",
  ok: "bg-ok",
}

const SEVERITY_COLOR: Record<ReadinessSeverity, string> = {
  bad: "var(--red)",
  warn: "var(--amber)",
  ok: "var(--ok)",
}

const SPARK_MIN = 30
const SPARK_MAX = 95

const Sparkline = ({ points }: { points: TrajectoryPoint[] }) => {
  if (points.length === 0) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-3">
        No scored runs
      </span>
    )
  }
  const values = points.length === 1 ? [points[0].score, points[0].score] : points.map((p) => p.score)
  const path = values
    .map((v, i) => {
      const x = 3 + (i / (values.length - 1)) * 114
      const y = 29 - ((Math.min(Math.max(v, SPARK_MIN), SPARK_MAX) - SPARK_MIN) / (SPARK_MAX - SPARK_MIN)) * 26
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
  const last = values[values.length - 1]
  const lastY = 29 - ((Math.min(Math.max(last, SPARK_MIN), SPARK_MAX) - SPARK_MIN) / (SPARK_MAX - SPARK_MIN)) * 26
  const dotColor = SEVERITY_COLOR[readinessSeverity(last)]
  return (
    <svg
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trajectory across ${points.length} scored ${points.length === 1 ? "run" : "runs"}, latest ${last}`}
      className="h-8 w-full"
    >
      <path d={path} fill="none" stroke="var(--on-surface-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={117} cy={lastY} r={2.3} fill={dotColor} />
    </svg>
  )
}

const IdeaRow = ({ idea, now }: { idea: IdeaStats; now: number }) => {
  const readiness = deriveReadiness(idea.latestRiskScores ?? undefined)
  const trajectory = deriveTrajectory(idea.runs)
  const overall = readiness.overall
  const underFire = readiness.underFire
  const underFireValue = underFire ? readiness.perAxis[underFire] : null

  return (
    <li>
      <Link
        href={`/ideas/${idea.ideaId}`}
        className="focus-ring group relative grid grid-cols-[1.4fr_1.3fr_100px_1fr_64px] items-center gap-4 border-b border-line px-3.5 py-[18px] transition-colors hover:bg-surface-raised max-lg:grid-cols-[1.4fr_1.3fr_1fr]"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-transparent transition-colors group-hover:bg-red"
        />
        <span>
          <span className="block font-display text-lg font-bold tracking-[-.01em]">{idea.name}</span>
          <span className="mt-[3px] block font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-3">
            {[idea.stage, idea.businessModel].filter(Boolean).join(" · ") || "No runs yet"}
          </span>
        </span>

        <span className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-[7px]">
            <span className="font-display text-xl font-extrabold tracking-[-.02em] tabular-nums">
              {overall ?? "—"}
            </span>
            <span className="font-mono text-[9px] text-on-surface-3">/ 100</span>
          </span>
          <span className="relative block h-[5px] overflow-hidden bg-line">
            {overall !== null && (
              <span
                className={cn("absolute inset-y-0 left-0", SEVERITY_BG[readinessSeverity(overall)])}
                style={{ width: `${overall}%` }}
              />
            )}
            <span
              aria-hidden="true"
              className="absolute -inset-y-[2px] w-px bg-red"
              style={{ left: `${INVESTOR_READY_LINE}%` }}
            />
          </span>
        </span>

        <span className="max-lg:hidden">
          <Sparkline points={trajectory} />
        </span>

        <span className="flex items-center gap-2">
          {underFire && underFireValue !== null ? (
            <>
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 flex-none", SEVERITY_BG[readinessSeverity(underFireValue)])}
              />
              <span className="font-mono text-[10.5px] uppercase tracking-[.04em]">
                {AXIS_LABELS[underFire]}
              </span>
              <span className="ml-auto font-mono text-[10.5px] tabular-nums text-on-surface-3">
                {underFireValue}
              </span>
            </>
          ) : (
            <span className="font-mono text-[10.5px] uppercase tracking-[.05em] text-on-surface-3">
              Unscored
            </span>
          )}
        </span>

        <span className="text-right max-lg:hidden">
          <span className="block font-display text-[15px] font-bold tabular-nums">{idea.runs.length}</span>
          <span className="mt-[2px] block font-mono text-[9px] uppercase text-on-surface-3">
            {formatAgo(idea.lastRunAt, now)}
          </span>
        </span>
      </Link>
    </li>
  )
}

export const IdeaList = ({ ideas }: { ideas: IdeaStats[] }) => {
  const now = useNow()
  return (
    <div>
      <div className="grid grid-cols-[1.4fr_1.3fr_100px_1fr_64px] gap-4 border-b border-line-2 px-3.5 pb-[9px] pt-3.5 font-mono text-[9.5px] uppercase tracking-[.14em] text-on-surface-3 max-lg:grid-cols-[1.4fr_1.3fr_1fr]">
        <span>Idea</span>
        <span>Readiness → ready line</span>
        <span className="max-lg:hidden">Trajectory</span>
        <span>Weakest axis</span>
        <span className="text-right max-lg:hidden">Runs</span>
      </div>
      <ul>
        {ideas.map((idea) => (
          <IdeaRow key={idea.ideaId} idea={idea} now={now} />
        ))}
      </ul>
    </div>
  )
}
