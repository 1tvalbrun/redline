"use client"

import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { BriefForm } from "@/components/simulation/intake/BriefForm"

const NewStressTestPage = () => {
  return (
    <FlowShell stage="brief">
      <BriefForm />
    </FlowShell>
  )
}

export default NewStressTestPage
