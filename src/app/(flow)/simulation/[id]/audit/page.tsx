"use client"

import { use } from "react"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AuditStage } from "@/components/simulation/intake/AuditStage"

const AuditPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return (
    <FlowShell stage="audit" simulationId={id}>
      <AuditStage simulationId={id} />
    </FlowShell>
  )
}

export default AuditPage
