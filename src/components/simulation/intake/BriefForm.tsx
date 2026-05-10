"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const FOCUS_OPTIONS = [
  "Market viability",
  "Technical feasibility",
  "Customer fit",
  "Go-to-market",
  "Unit economics",
  "Competitive positioning",
]

export const BriefForm = () => {
  const router = useRouter()
  const createSimulation = useMutation(api.simulations.create)
  const analyzeSimulation = useAction(api.simulations.analyze)

  const [ideaName, setIdeaName] = useState("")
  const [stage, setStage] = useState("idea")
  const [description, setDescription] = useState("")
  const [targetUser, setTargetUser] = useState("")
  const [businessModel, setBusinessModel] = useState("")
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleToggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaName || !description) return

    setIsSubmitting(true)
    const id = await createSimulation({
      title: ideaName,
      roomType: "investor_panel",
      brief: {
        ideaName,
        stage,
        description,
        targetUser,
        businessModel,
        focusAreas,
      },
    })
    router.push(`/simulation/${id}/analyze`)
    analyzeSimulation({ id })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Idea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ideaName">
              Idea Name
            </label>
            <Input
              id="ideaName"
              value={ideaName}
              onChange={(e) => setIdeaName(e.target.value)}
              placeholder="e.g., AI-powered code review tool"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="stage">
              Stage
            </label>
            <select
              id="stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="idea">Idea</option>
              <option value="mvp">MVP</option>
              <option value="beta">Beta</option>
              <option value="growth">Growth</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your idea in 2-3 sentences..."
              rows={4}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="targetUser">
              Target User
            </label>
            <Input
              id="targetUser"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="e.g., Engineering teams at mid-size startups"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="businessModel">
              Business Model
            </label>
            <Input
              id="businessModel"
              value={businessModel}
              onChange={(e) => setBusinessModel(e.target.value)}
              placeholder="e.g., SaaS, per-seat pricing"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focus Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => handleToggleFocus(area)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  focusAreas.includes(area)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={isSubmitting || !ideaName || !description}>
        {isSubmitting ? "Creating..." : "Start Analysis"}
      </Button>
    </form>
  )
}
