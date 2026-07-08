"use client"

import { use } from "react"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { PanelSetup } from "@/components/simulation/intake/PanelSetup"

const PanelPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return (
    <FlowShell stage="panel" simulationId={id}>
      <PanelSetup simulationId={id} />
    </FlowShell>
  )
}

export default PanelPage
