"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

const HomePage = () => {
  const simulations = useQuery(api.simulations.list)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your recent simulations and activity"
      />

      <div className="mb-6">
        <Link href="/simulation/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Simulation
          </Button>
        </Link>
      </div>

      {simulations === undefined && (
        <p className="text-muted-foreground">Loading...</p>
      )}

      {simulations && simulations.length === 0 && (
        <p className="text-muted-foreground">
          No simulations yet. Create your first one to get started.
        </p>
      )}

      {simulations && simulations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {simulations.map((sim) => (
            <Card key={sim._id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{sim.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{sim.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    v{sim.version}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default HomePage
