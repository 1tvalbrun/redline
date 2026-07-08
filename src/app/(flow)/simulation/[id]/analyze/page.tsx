"use client"

import { use } from "react"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AnalysisPipeline } from "@/components/simulation/intake/AnalysisPipeline"

const ReadPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return (
    <FlowShell stage="read" simulationId={id}>
      <AnalysisPipeline simulationId={id} />
    </FlowShell>
  )
}

export default ReadPage
