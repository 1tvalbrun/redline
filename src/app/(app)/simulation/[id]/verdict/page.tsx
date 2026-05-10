"use client"

import { use } from "react"
import { VerdictScreen } from "@/components/simulation/verdict/VerdictScreen"

const VerdictPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)

  return <VerdictScreen simulationId={id} />
}

export default VerdictPage
