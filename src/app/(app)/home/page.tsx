"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import {
  deriveReadiness,
  AXIS_LABELS,
  INVESTOR_READY_LINE,
  type Axis,
  type Readiness,
} from "@/lib/readiness"
import { formatAgo, formatDay } from "@/lib/utils"
import { useNow } from "@/lib/useNow"
import { ReadinessGauge } from "@/components/shared/ReadinessGauge"
import { IdeaList, type IdeaStats } from "@/components/workspace/IdeaList"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"
import { WORKSPACE_CTA } from "@/components/workspace/cta"

const Shimmer = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-surface-2 ${className ?? ""}`} />
)

const Module = ({
  title,
  action,
  children,
}: {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) => (
  <section className="mb-[22px] border border-line-2 bg-surface-raised">
    <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="focus-ring font-mono text-[10px] uppercase tracking-[.06em] text-on-surface-3 hover:text-red-fg"
        >
          {action.label}
        </Link>
      )}
    </div>
    <div className="p-4">{children}</div>
  </section>
)

type WeakestSignal = {
  idea: IdeaStats
  axis: Axis
  value: Readiness
}

const findWeakestSignal = (ideas: IdeaStats[]): WeakestSignal | null => {
  let weakest: WeakestSignal | null = null
  for (const idea of ideas) {
    const readiness = deriveReadiness(idea.latestRiskScores ?? undefined)
    if (readiness.underFire === null) continue
    const value = readiness.perAxis[readiness.underFire]
    if (value === null) continue
    if (weakest === null || value < weakest.value) {
      weakest = { idea, axis: readiness.underFire, value }
    }
  }
  return weakest
}

const greeting = (hour: number) =>
  hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening."

const OverviewPage = () => {
  const ideas = useQuery(api.ideas.listWithStats)
  const sessions = useQuery(api.rooms.list)
  const nowMs = useNow()
  const now = new Date(nowMs)

  if (ideas === undefined) {
    return (
      <div className="space-y-6">
        <Shimmer className="h-10 w-72" />
        <Shimmer className="h-40 w-full" />
        <Shimmer className="h-64 w-full" />
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
        <ReadinessGauge value={null} className="mb-3.5 h-[150px] w-[220px]" />
        <p className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[.2em] text-on-surface-3">
          No ideas tested yet
        </p>
        <h1 className="font-display text-[clamp(26px,3.2vw,40px)] font-bold tracking-[-.01em]">
          Let&apos;s find the crack before your investors do.
        </h1>
        <p className="mx-auto mb-7 mt-3.5 max-w-[42ch] text-[15.5px] text-on-surface-2">
          Add your first idea and brief the panel in ninety seconds. Redline reads
          what you give it and puts it under real pressure.
        </p>
        <Link href="/simulation/new" className={WORKSPACE_CTA}>
          Add your first idea <span aria-hidden="true">→</span>
        </Link>
      </div>
    )
  }

  const weakest = findWeakestSignal(ideas)
  const closest = ideas
    .map((idea) => ({ idea, overall: deriveReadiness(idea.latestRiskScores ?? undefined).overall }))
    .filter((entry): entry is { idea: IdeaStats; overall: Readiness } => entry.overall !== null)
    .sort((a, b) => b.overall - a.overall)[0]
  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">
          {greeting(now.getHours())}
        </h1>
        <p className="text-right font-mono text-[11px] uppercase leading-[1.7] tracking-[.12em] text-on-surface-3">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>

      {weakest && (
        <section className="mb-[26px] grid border border-on-surface bg-surface-raised md:grid-cols-[1fr_300px]">
          <div className="p-7">
            <p className="mb-3.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-red-fg">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse-red rounded-full bg-red" />
              Your move
            </p>
            <h2 className="max-w-[26ch] font-display text-[clamp(19px,2vw,26px)] font-bold leading-[1.14] tracking-[-.01em]">
              {weakest.idea.name}&apos;s{" "}
              <span className="border-b-2 border-red">
                {AXIS_LABELS[weakest.axis].toLowerCase()} readiness
              </span>{" "}
              is its weakest axis, and it&apos;s holding the whole score down.
            </h2>
            <p className="mt-3 max-w-[44ch] text-sm leading-[1.55] text-on-surface-2">
              The last run scored it {weakest.value} of 100. Close the gap and re-run.
              That&apos;s the fastest path toward the investor-ready line.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link href={`/ideas/${weakest.idea.ideaId}`} className={WORKSPACE_CTA}>
                Open {weakest.idea.name} <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/simulation/new"
                className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
              >
                Or start a fresh test
              </Link>
            </div>
          </div>
          <div
            data-surface="dark"
            className="flex flex-col items-center justify-center bg-surface p-6 text-on-surface"
          >
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-on-surface-2">
              {AXIS_LABELS[weakest.axis]} axis
            </p>
            <p className="my-1.5 font-display text-6xl font-extrabold leading-none tracking-[-.03em] text-red-fg tabular-nums">
              {weakest.value}
            </p>
            <div className="relative h-1 w-full bg-white/15">
              <span
                className="absolute inset-y-0 left-0 bg-red"
                style={{ width: `${weakest.value}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute -inset-y-[2px] w-px bg-white"
                style={{ left: `${INVESTOR_READY_LINE}%` }}
              />
            </div>
            <p className="mt-2 self-start font-mono text-[9.5px] uppercase tracking-[.1em] text-on-surface-2">
              {INVESTOR_READY_LINE - weakest.value} below the ready line
            </p>
          </div>
        </section>
      )}

      <div className="grid items-start gap-[26px] lg:grid-cols-[1fr_360px]">
        <div>
          <section aria-label="Your ideas">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[.16em] text-on-surface-2">
                <b className="font-semibold text-on-surface">Your ideas</b> · {ideas.length} in progress
              </h2>
              <Link
                href="/ideas"
                className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
              >
                View all →
              </Link>
            </div>
            <IdeaList ideas={ideas} />
          </section>
        </div>

        <div>
          {closest && (
            <Module
              title="Closest to ready"
              action={{ label: "Open →", href: `/ideas/${closest.idea.ideaId}` }}
            >
              <div className="flex flex-col items-center text-center">
                <ReadinessGauge value={closest.overall} className="h-[120px] w-[180px]" />
                <p className="mt-0.5 font-display text-[17px] font-bold">{closest.idea.name}</p>
                <p className="mt-1.5 text-[12.5px] text-on-surface-2">
                  {closest.overall >= INVESTOR_READY_LINE ? (
                    <b className="font-semibold text-ok">Over the line.</b>
                  ) : (
                    <>
                      <b className="font-semibold text-ok">
                        {INVESTOR_READY_LINE - closest.overall} to go.
                      </b>{" "}
                      Close the weakest axis and it crosses the line.
                    </>
                  )}
                </p>
              </div>
            </Module>
          )}

          <Module title="Recent sessions" action={{ label: "All →", href: "/sessions" }}>
            {sessions === undefined ? (
              <Shimmer className="h-24 w-full" />
            ) : sessions.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-2">No sessions yet.</p>
            ) : (
              <ul>
                {sessions.slice(0, 3).map((session) => (
                  <li key={session.roomId} className="border-t border-line py-[11px] first:border-t-0 first:pt-0">
                    <Link
                      href={`/sessions/${session.roomId}`}
                      className="focus-ring flex items-center gap-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {session.ideaName}
                          {session.panelist && ` · ${session.panelist}`}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[.04em] text-on-surface-3">
                          {formatDay(session.at)} · {session.turns} turns ·{" "}
                          {formatAgo(session.at, nowMs)}
                        </span>
                      </span>
                      {session.decision && <VerdictBadge decision={session.decision} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Module>
        </div>
      </div>
    </div>
  )
}

export default OverviewPage
