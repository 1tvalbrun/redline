"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useAction } from "convex/react"
import { Upload } from "lucide-react"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"

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
  { value: "saas-seat", label: "SaaS: per-seat pricing" },
  { value: "saas-usage", label: "SaaS: usage-based pricing" },
  { value: "saas-tiered", label: "SaaS: tiered subscription" },
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

const FieldLabel = ({
  htmlFor,
  hint,
  children,
}: {
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) => (
  <label
    htmlFor={htmlFor}
    className="mb-[9px] flex justify-between font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2"
  >
    {children}
    {hint && <span className="text-on-surface-3 normal-case tracking-normal">{hint}</span>}
  </label>
)

const chipClass = (active: boolean) =>
  cn(
    "focus-ring border px-[13px] py-2 font-mono text-[11px] uppercase tracking-[.04em] transition-colors",
    active
      ? "border-on-surface bg-on-surface text-surface"
      : "border-line-2 bg-surface-raised text-on-surface-2 hover:text-on-surface"
  )

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
  const [submitFailed, setSubmitFailed] = useState(false)

  const handleToggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaName || !description) return
    setIsSubmitting(true)
    setSubmitFailed(false)

    const targetUserLabel =
      TARGET_OPTIONS.find((o) => o.value === targetUser)?.label ?? targetUser
    const businessModelLabel =
      BUSINESS_MODEL_OPTIONS.find((o) => o.value === businessModel)?.label ??
      businessModel
    const stageLabel =
      STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage

    try {
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
    } catch {
      setSubmitFailed(true)
      setIsSubmitting(false)
    }
  }

  const checklist = [
    { label: "Idea named", done: ideaName.trim().length > 0 },
    { label: "Pitch described", done: description.trim().length > 0 },
    { label: "Focus areas chosen (optional)", done: focusAreas.length > 0 },
  ]

  return (
    <form onSubmit={handleSubmit}>
      <StageKicker>New stress test · Step 1 of 6</StageKicker>
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        What are we putting under pressure?
      </h1>
      <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
        Tell the panel what you&apos;re building. The more you give it, the harder
        and more useful the interrogation becomes.
      </p>

      <div className="mt-[34px] grid items-start gap-[34px] max-md:grid-cols-1 md:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-[22px]">
            <FieldLabel htmlFor="ideaName">Idea name</FieldLabel>
            <Input
              id="ideaName"
              value={ideaName}
              onChange={(e) => setIdeaName(e.target.value)}
              placeholder="e.g., Cartograph"
              className="bg-surface-raised"
              required
            />
          </div>

          <div className="mb-[22px]">
            <FieldLabel htmlFor="pitch" hint="plain language is fine">
              The idea
            </FieldLabel>
            <Textarea
              id="pitch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it does, who it's for, and the bet that has to be right for it to work."
              className="min-h-[120px] bg-surface-raised p-4 text-[15px] leading-[1.55]"
              required
            />
          </div>

          <fieldset className="mb-[22px]">
            <legend className="mb-[9px] block w-full font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
              Stage
            </legend>
            <div className="flex flex-wrap gap-2">
              {STAGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={stage === o.value}
                  onClick={() => setStage(o.value)}
                  className={chipClass(stage === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mb-[22px] grid gap-[22px] md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="targetUser">Target user</FieldLabel>
              <Select
                value={targetUser}
                onValueChange={(value) => value !== null && setTargetUser(value)}
              >
                <SelectTrigger id="targetUser" className="h-9 w-full bg-surface-raised">
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
              <FieldLabel htmlFor="businessModel">Business model</FieldLabel>
              <Select
                value={businessModel}
                onValueChange={(value) => value !== null && setBusinessModel(value)}
              >
                <SelectTrigger id="businessModel" className="h-9 w-full bg-surface-raised">
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

          <fieldset className="mb-[22px]">
            <legend className="mb-[9px] block w-full font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
              What do you want challenged most?
            </legend>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((area) => (
                <button
                  key={area}
                  type="button"
                  aria-pressed={focusAreas.includes(area)}
                  onClick={() => handleToggleFocus(area)}
                  className={chipClass(focusAreas.includes(area))}
                >
                  {area}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <FieldLabel hint="coming with the audit">Materials</FieldLabel>
            <div className="border border-dashed border-line-2 bg-surface-raised p-5 opacity-60">
              <div className="flex items-center gap-3">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center border border-line-2">
                  <Upload aria-hidden="true" className="h-[18px] w-[18px] text-on-surface-2" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Drop a deck, model, one-pager…</p>
                  <p className="mt-[2px] font-mono text-[10px] uppercase tracking-[.06em] text-on-surface-3">
                    Materials ingest isn&apos;t wired up yet. It arrives with the audit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="sticky top-5 border border-line-2 bg-surface-raised p-[22px]">
          <h2 className="mb-4 font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
            Intake signal
          </h2>
          <ul className="border-t border-line">
            {checklist.map((item) => (
              <li
                key={item.label}
                className={cn(
                  "flex items-center gap-[10px] py-[7px] text-[13px]",
                  item.done ? "text-on-surface-2" : "text-on-surface-3"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-[15px] w-[15px] flex-none items-center justify-center border text-[10px] text-white",
                    item.done ? "border-ok bg-ok" : "border-line-2"
                  )}
                >
                  {item.done && "✓"}
                </span>
                {item.label}
                <span className="sr-only">{item.done ? ", provided" : ", not yet"}</span>
              </li>
            ))}
            <li className="flex items-center gap-[10px] py-[7px] text-[13px] text-on-surface-3">
              <span aria-hidden="true" className="h-[15px] w-[15px] flex-none border border-line-2" />
              Materials (arrive with the audit)
            </li>
          </ul>
        </aside>
      </div>

      <div className="mt-5">
        <button type="submit" disabled={isSubmitting || !ideaName || !description} className={FLOW_BTN}>
          {isSubmitting ? "Starting the read…" : "Read my brief"}
          <span aria-hidden="true">→</span>
        </button>
        {submitFailed && (
          <p role="alert" className="mt-3 text-[13px] text-red-fg">
            Couldn&apos;t start the stress test. Check your connection and try again.
          </p>
        )}
      </div>
    </form>
  )
}
