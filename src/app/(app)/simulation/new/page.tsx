"use client"

import { PageHeader } from "@/components/layout/PageHeader"
import { BriefForm } from "@/components/simulation/intake/BriefForm"

const NewSimulationPage = () => {
  return (
    <div>
      <PageHeader
        title="New Simulation"
        description="Brief the panel on your idea"
      />
      <BriefForm />
    </div>
  )
}

export default NewSimulationPage
