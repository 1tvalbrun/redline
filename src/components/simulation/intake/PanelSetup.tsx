"use client"

import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEFAULT_CHARACTERS } from "../characters"

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })
  const createRoom = useMutation(api.rooms.create)

  const handleStartRoom = async () => {
    await createRoom({
      simulationId: simulationId as Id<"simulations">,
      characters: DEFAULT_CHARACTERS,
    })
    router.push(`/simulation/${simulationId}/room`)
  }

  if (!simulation) return <p className="text-muted-foreground">Loading...</p>

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {DEFAULT_CHARACTERS.map((char) => (
          <Card key={char.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{char.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{char.role}</p>
              <p className="mt-2 text-xs">{char.tone}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="lg" onClick={handleStartRoom}>
        Enter the Room
      </Button>
    </div>
  )
}
