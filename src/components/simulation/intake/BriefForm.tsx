"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useAction } from "convex/react"
import { ArrowRight } from "lucide-react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STAGE_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "beta", label: "Beta" },
  { value: "early-revenue", label: "Early revenue" },
  { value: "growth", label: "Growth / Series A+" },
]

const TARGET_OPTIONS = [
  { value: "smb-founders", label: "SMB founders and operators" },
  { value: "midmarket-leaders", label: "Mid-market product & strategy leaders" },
  { value: "enterprise-buyers", label: "Enterprise buyers ($500M+ ARR)" },
  { value: "vc-backed-saas", label: "VC-backed B2B SaaS, Series B–D, $20–500M ARR" },
  { value: "developers", label: "Developers and engineering teams" },
  { value: "designers-creators", label: "Designers and creators" },
  { value: "consumers", label: "Direct-to-consumer audiences" },
]

const BUSINESS_MODEL_OPTIONS = [
  { value: "saas-seat", label: "SaaS — per-seat pricing" },
  { value: "saas-usage", label: "SaaS — usage-based pricing" },
  { value: "saas-tiered", label: "SaaS — tiered subscription" },
  { value: "marketplace", label: "Marketplace / take-rate" },
  { value: "ads", label: "Ad-supported / free with ads" },
  { value: "transactional", label: "Transactional / one-time" },
  { value: "freemium", label: "Freemium with paid upgrade" },
  { value: "enterprise-license", label: "Enterprise license" },
]

const FOCUS_OPTIONS = [
  "Market need",
  "Willingness to pay",
  "Technical feasibility",
  "Competition",
  "Go-to-market",
  "Pricing",
  "User experience",
  "Fundraising story",
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

    const targetUserLabel =
      TARGET_OPTIONS.find((o) => o.value === targetUser)?.label ?? targetUser
    const businessModelLabel =
      BUSINESS_MODEL_OPTIONS.find((o) => o.value === businessModel)?.label ??
      businessModel
    const stageLabel =
      STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage

    const id = await createSimulation({
      title: ideaName,
      roomType: "investor_panel",
      brief: {
        ideaName,
        stage: stageLabel,
        description,
        targetUser: targetUserLabel,
        businessModel: businessModelLabel,
        focusAreas,
      },
    })
    router.push(`/simulation/${id}/analyze`)
    analyzeSimulation({ id })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col space-y-10"
    >
      <header>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Link href="/home" className="hover:text-foreground">← Home</Link>
          <span className="mx-2">·</span>
          Founder Room · Step 1 of 3
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">
          Brief the room.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Give the panel enough context to challenge your idea intelligently. Most
          founders use 90 seconds here.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="ideaName">
            Idea name
          </label>
          <Input
            id="ideaName"
            value={ideaName}
            onChange={(e) => setIdeaName(e.target.value)}
            placeholder="e.g., Cartograph"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Stage</label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Select a stage" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="description">
          Describe your idea
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="In 2–3 sentences: what does it do, who is it for, and what's the bet that has to be right for it to work?"
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">Target user</label>
          <Select value={targetUser} onValueChange={setTargetUser}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Who is this for?" />
            </SelectTrigger>
            <SelectContent>
              {TARGET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Business model</label>
          <Select value={businessModel} onValueChange={setBusinessModel}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="How do you make money?" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_MODEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium">
          What do you want challenged most?
        </label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((area) => {
            const active = focusAreas.includes(area)
            return (
              <button
                key={area}
                type="button"
                onClick={() => handleToggleFocus(area)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {area}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">
          Step 1 of 3 — Brief · Analyze · Panel
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || !ideaName || !description}
          className="gap-2"
        >
          {isSubmitting ? "Creating..." : "Continue to analysis"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}
