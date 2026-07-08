"use client"

import { use } from "react"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { ReportView } from "@/components/simulation/report/ReportView"

const VerdictPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return (
    <FlowShell stage="verdict" simulationId={id}>
      <ReportView simulationId={id} />
    </FlowShell>
  )
}

export default VerdictPage
