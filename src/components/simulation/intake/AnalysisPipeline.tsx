"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const SLOW_READ_MS = 20_000

type AnalysisPipelineProps = {
  simulationId: string
}

export const AnalysisPipeline = ({ simulationId }: AnalysisPipelineProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const analyzePractice = useAction(api.practices.analyze)
  const [isSlow, setIsSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const ready = practice?.status === "ready" && !!practice.context

  // The findings live on the Audit stage — advance the moment the read
  // completes rather than making the user wait out the animation.
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
    analyzePractice({ id: typedId })
      .catch(() => setIsSlow(true))
      .finally(() => setRetrying(false))
  }

  if (practice === undefined) return null
  if (practice === null) return <IdeaNotFound />
  if (ready) return null

  const pack = getPack(practice.packId)
  const wait = pack.copy.readWait

  return (
    <div>
      <WaitingScreen
        kicker={wait.kicker}
        heading={wait.heading(scopeText(practice.scope, pack.subjectField))}
        lead={wait.lead}
        rows={wait.rows}
        work={wait.work}
        ticker={wait.ticker}
        stepMs={wait.stepMs}
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
            className={cn(BTN_PRIMARY, "mt-4")}
          >
            {retrying ? "Retrying the read…" : "Retry the read"}
          </button>
        </div>
      )}
    </div>
  )
}
