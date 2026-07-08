"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { CONTEXT_FIELDS } from "@/types/simulation"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// Static so Tailwind compiles the staggered reveal.
const LINE_DELAYS = [
  "[animation-delay:.1s]",
  "[animation-delay:.3s]",
  "[animation-delay:.5s]",
  "[animation-delay:.7s]",
  "[animation-delay:.9s]",
  "[animation-delay:1.1s]",
  "[animation-delay:1.3s]",
]

const SLOW_READ_MS = 20_000

const WorkingCaret = () => (
  <span
    aria-hidden="true"
    className="ml-[2px] inline-block h-[15px] w-[7px] animate-blink bg-red-fg align-[-2px]"
  />
)

type AnalysisPipelineProps = {
  simulationId: string
}

export const AnalysisPipeline = ({ simulationId }: AnalysisPipelineProps) => {
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const analyzeSimulation = useAction(api.simulations.analyze)
  const [isSlow, setIsSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const ready = simulation?.status === "ready" && !!simulation.context

  // Watchdog re-arms per attempt so a hung retry surfaces again.
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setIsSlow(true), SLOW_READ_MS)
    return () => clearTimeout(timer)
  }, [ready, attempt])

  const handleRetry = () => {
    setIsSlow(false)
    setRetrying(true)
    setAttempt((n) => n + 1)
    analyzeSimulation({ id: typedId })
      .catch(() => setIsSlow(true))
      .finally(() => setRetrying(false))
  }

  if (simulation === undefined) return null
  if (simulation === null) return <IdeaNotFound />

  const ideaName = simulation.brief.ideaName

  return (
    <div className="flex flex-col items-center pt-5 text-center">
      <StageKicker>Reading your brief</StageKicker>
      <h1 className="font-display text-[clamp(24px,3vw,34px)] font-bold tracking-[-.01em]">
        {ready ? `${ideaName} — read complete.` : `Reading ${ideaName}…`}
      </h1>

      <div
        data-surface="dark"
        className="mt-[26px] min-h-[180px] w-full max-w-[620px] border border-surface-raised bg-surface p-[16px_18px] text-left font-mono text-[12.5px] leading-[1.85] text-on-surface-2"
        role="log"
        aria-label="Read progress"
      >
        <p>
          <span className="text-on-surface-3">01</span>{" "}
          Opening <b className="font-semibold text-on-surface">{ideaName}</b> …
          {simulation.status === "draft" && <WorkingCaret />}
        </p>
        {simulation.status !== "draft" && (
          <p>
            <span className="text-on-surface-3">02</span>{" "}
            Extracting problem space, assumptions, and risk vectors …
            {!ready && <WorkingCaret />}
          </p>
        )}
        {ready &&
          CONTEXT_FIELDS.map((field, i) => (
            <p
              key={field.key}
              className={cn(
                "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300",
                LINE_DELAYS[i]
              )}
            >
              <span className="text-ok-fg">✓</span>{" "}
              <b className="font-semibold text-on-surface">{field.label}</b> —{" "}
              {simulation.context?.[field.key]}
            </p>
          ))}
        {!ready && isSlow && (
          <p className="text-amber-fg">
            <span aria-hidden="true">!</span> This is taking longer than usual.
          </p>
        )}
      </div>

      {!ready && isSlow && (
        <button type="button" onClick={handleRetry} disabled={retrying} className={cn(FLOW_BTN, "mt-6")}>
          {retrying ? "Retrying the read…" : "Retry the read"}
        </button>
      )}

      <div className="mt-6">
        {ready ? (
          <Link href={`/simulation/${simulationId}/audit`} className={FLOW_BTN}>
            See what we found <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <p aria-live="polite" className="font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-3">
            {simulation.status === "draft"
              ? "Starting the read…"
              : "The panel's analyst is reading — this is a live model call"}
          </p>
        )}
      </div>
    </div>
  )
}
