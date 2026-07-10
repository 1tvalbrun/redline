"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { FLOW_BTN } from "@/components/simulation/flow/FlowShell"
import { WaitingScreen, READ_WAIT } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const SLOW_READ_MS = 20_000

type AnalysisPipelineProps = {
  simulationId: string
}

export const AnalysisPipeline = ({ simulationId }: AnalysisPipelineProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const analyzeSimulation = useAction(api.simulations.analyze)
  const [isSlow, setIsSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const ready = simulation?.status === "ready" && !!simulation.context

  // The findings live on the Audit stage — advance the moment the read
  // completes rather than making the founder wait out the animation.
  useEffect(() => {
    if (ready) router.replace(`/simulation/${simulationId}/audit`)
  }, [ready, router, simulationId])

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
  if (ready) return null

  return (
    <div>
      <WaitingScreen
        kicker="Reading your brief"
        heading="Going through what you gave us."
        lead="The panel's analyst reads every line before a single question. This takes a few seconds."
        {...READ_WAIT}
      />
      {isSlow && (
        <div className="mt-8">
          <p role="status" className="text-[13.5px] text-amber-fg">
            This is taking longer than usual.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className={cn(FLOW_BTN, "mt-4")}
          >
            {retrying ? "Retrying the read…" : "Retry the read"}
          </button>
        </div>
      )}
    </div>
  )
}
