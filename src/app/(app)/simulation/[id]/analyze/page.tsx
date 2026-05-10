"use client"

import { use } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { AnalysisPipeline } from "@/components/simulation/intake/AnalysisPipeline"

const AnalyzePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)

  return (
    <div>
      <PageHeader
        title="Analyzing Brief"
        description="AI is extracting context from your submission"
      />
      <AnalysisPipeline simulationId={id} />
    </div>
  )
}

export default AnalyzePage
