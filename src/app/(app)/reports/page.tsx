"use client"

import { PageHeader } from "@/components/layout/PageHeader"

const ReportsPage = () => {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="View completed simulation reports"
      />
      <p className="text-muted-foreground">
        Your completed simulation reports will appear here.
      </p>
    </div>
  )
}

export default ReportsPage
