"use client"

import { use } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { PanelSetup } from "@/components/simulation/intake/PanelSetup"

const PanelPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)

  return (
    <div>
      <PageHeader
        title="Panel Setup"
        description="Review your panel characters before entering the room"
      />
      <PanelSetup simulationId={id} />
    </div>
  )
}

export default PanelPage
