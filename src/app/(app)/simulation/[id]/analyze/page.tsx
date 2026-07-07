"use client"

import { use } from "react"
import { AnalysisPipeline } from "@/components/simulation/intake/AnalysisPipeline"

const AnalyzePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  return <AnalysisPipeline simulationId={id} />
}

export default AnalyzePage
