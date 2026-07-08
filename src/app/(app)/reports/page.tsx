"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { cn, formatDay } from "@/lib/utils"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"

const FILTERS = ["all", "advance", "iterate", "pass"] as const
type Filter = (typeof FILTERS)[number]

const VerdictsPage = () => {
  const reports = useQuery(api.reports.list)
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = reports?.filter((r) => filter === "all" || r.verdict === filter)

  return (
    <div>
      <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">Verdicts</h1>

      <div className="mt-5 flex gap-2" role="group" aria-label="Filter by verdict">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "focus-ring border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.06em] transition-colors",
              filter === f
                ? "border-on-surface bg-on-surface text-surface"
                : "border-line-2 bg-surface-raised text-on-surface-2 hover:text-on-surface"
            )}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {reports === undefined ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse bg-surface-2" />
            <div className="h-12 animate-pulse bg-surface-2" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-[13.5px] text-on-surface-2">
            No verdicts yet. They land here after each run.{" "}
            <Link href="/simulation/new" className="focus-ring underline hover:text-red-fg">
              Start a stress test
            </Link>
            .
          </p>
        ) : filtered && filtered.length === 0 ? (
          <p className="text-[13.5px] text-on-surface-2">No {filter} verdicts yet.</p>
        ) : (
          <ul>
            {filtered?.map((report) => (
              <li key={report.reportId}>
                <Link
                  href={`/simulation/${report.simulationId}/report`}
                  className="focus-ring grid grid-cols-[64px_1fr_120px_90px_50px] items-center gap-4 border-b border-line px-3.5 py-3.5 transition-colors hover:bg-surface-raised max-md:grid-cols-[64px_1fr_90px]"
                >
                  <span className="font-mono text-[11px] text-on-surface-3">{formatDay(report.at)}</span>
                  <span className="truncate font-display text-base font-bold tracking-[-.01em]">
                    {report.ideaName}
                  </span>
                  <span className="truncate font-mono text-[9.5px] uppercase text-on-surface-3 max-md:hidden">
                    {report.panelist ?? "—"}
                  </span>
                  <span>
                    <VerdictBadge decision={report.verdict} />
                  </span>
                  <span className="text-right font-display text-base font-bold tabular-nums max-md:hidden">
                    {report.score}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default VerdictsPage
