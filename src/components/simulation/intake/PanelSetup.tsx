"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_CHARACTERS } from "../characters"

type PanelSetupProps = {
  simulationId: string
}

const CHARACTER_FOCUS: Record<string, string[]> = {
  "vc-01": ["Market sizing", "Defensibility", "Pricing power", "Round dynamics"],
  "tc-01": ["Buying process", "Switching cost", "Procurement"],
  "ta-01": ["Latency", "Reliability", "Build vs buy", "ML infra"],
}

const CHARACTER_HOOK: Record<string, string> = {
  "vc-01":
    "Will challenge market size, moats, defensibility and runway logic.",
  "tc-01":
    "Reacts as your real buyer. Pushes on urgency and trust.",
  "ta-01":
    "Stress-tests feasibility, cost, latency, and dependency risk.",
}

const CHARACTER_QUOTE: Record<string, string> = {
  "vc-01": "\"Sharp. Pattern-matches against 200 portfolio companies.\"",
  "tc-01": "\"Pragmatic. Three vendors deep, one budget cycle away.\"",
  "ta-01": "\"Methodical. Has shipped this before, knows where it breaks.\"",
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })
  const createRoom = useMutation(api.rooms.create)
  const [selected, setSelected] = useState(DEFAULT_CHARACTERS[0].id)
  const [isStarting, setIsStarting] = useState(false)

  const handleStartRoom = async () => {
    const character = DEFAULT_CHARACTERS.find((c) => c.id === selected)
    if (!character) return
    setIsStarting(true)
    const { image: _image, ...charForConvex } = character
    await createRoom({
      simulationId: simulationId as Id<"simulations">,
      characters: [charForConvex],
    })
    router.push(`/simulation/${simulationId}/room`)
  }

  if (!simulation) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="max-w-6xl space-y-10">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Founder Room · Step 3 of 3 · {simulation.brief.ideaName}
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">
          Your panel is ready.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Three experts, three incentives, three different ways to be wrong about
          your idea. Pick the panelist to face first.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {DEFAULT_CHARACTERS.map((char) => {
          const isSelected = selected === char.id
          const focus = CHARACTER_FOCUS[char.id] ?? []
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => setSelected(char.id)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all",
                isSelected
                  ? "border-primary ring-2 ring-primary/30 shadow-lg"
                  : "border-border hover:border-primary/40 hover:shadow-sm"
              )}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[#1C1C1E]">
                <Image
                  src={char.image}
                  alt={char.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/80">
                    The {char.archetypeId === "vc" ? "VC" : char.archetypeId === "target_customer" ? "Target Customer" : "Technical Architect"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {char.name}
                  </p>
                  <p className="text-xs text-white/70">{char.role}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-5">
                <p className="text-sm leading-relaxed text-foreground">
                  {CHARACTER_HOOK[char.id]}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {focus.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-1 border-t border-border pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Tone
                  </p>
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    {CHARACTER_QUOTE[char.id]}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <Button
          size="lg"
          onClick={handleStartRoom}
          disabled={isStarting}
          className="gap-2"
        >
          {isStarting ? "Starting room..." : "Enter the room"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
