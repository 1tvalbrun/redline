"use client"

import { use } from "react"
import { ReportView } from "@/components/simulation/report/ReportView"

const ReportPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)

  return <ReportView simulationId={id} />
}

export default ReportPage
