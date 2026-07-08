"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useAction } from "convex/react"
import { Keyboard, Mic, Upload, X } from "lucide-react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn, formatElapsed } from "@/lib/utils"
import {
  BUSINESS_MODEL_OPTIONS,
  FOCUS_OPTIONS,
  STAGE_OPTIONS,
  TARGET_OPTIONS,
  optionLabel,
  type BriefOption,
} from "@/lib/briefOptions"
import { type ExtractedBrief } from "@/lib/intake"
import { REJECTION_MESSAGES, validateMaterialFile } from "@/lib/materials"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FLOW_BTN } from "@/components/simulation/flow/FlowShell"
import { PitchRecorder } from "./PitchRecorder"

type UploadEntry = { key: string; name: string; size: number } & (
  | { state: "uploading" }
  | { state: "ready"; storageId: Id<"_storage"> }
  | { state: "rejected"; reason: string }
)

type PitchOrigin = { kind: "voice"; seconds: number } | { kind: "deck"; fileName: string }

type Phase =
  | { step: "invite" }
  | { step: "capturing"; guided: boolean }
  | { step: "drafting"; origin: PitchOrigin; pitch: string; failed: boolean }
  | { step: "assembled"; extraction: ExtractedBrief | null; sourceLabel: string; eyebrow: string }

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`

const chipClass = (active: boolean) =>
  cn(
    "focus-ring border px-[13px] py-2 font-mono text-[11px] uppercase tracking-[.04em] transition-colors",
    active
      ? "border-on-surface bg-on-surface text-surface"
      : "border-line-2 bg-surface-raised text-on-surface-2 hover:text-on-surface"
  )

const FieldLabel = ({
  htmlFor,
  status,
  children,
}: {
  htmlFor: string
  status: "extracted" | "gap" | null
  children: React.ReactNode
}) => (
  <label
    htmlFor={htmlFor}
    className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2"
  >
    {children}
    {status && (
      <span
        className={cn(
          "flex items-center gap-1.5 tracking-[.06em]",
          status === "extracted" ? "text-on-surface-3" : "text-amber-fg"
        )}
      >
        <span
          aria-hidden="true"
          className={cn("h-[5px] w-[5px] rounded-full", status === "extracted" ? "bg-ok" : "bg-amber")}
        />
        {status === "extracted" ? "extracted" : "not heard"}
      </span>
    )}
  </label>
)

type BriefFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  gapHint: string
  status: "extracted" | "gap" | null
  textarea?: boolean
  controlClassName?: string
  required?: boolean
}

const BriefField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  gapHint,
  status,
  textarea,
  controlClassName,
  required,
}: BriefFieldProps) => {
  const controlProps = {
    id,
    value,
    placeholder,
    required,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    className: cn(
      "bg-surface-raised",
      controlClassName,
      status === "gap" && "border-dashed border-amber-fg bg-amber/5"
    ),
  }
  return (
    <div className="mb-5">
      <FieldLabel htmlFor={id} status={status}>
        {label}
      </FieldLabel>
      {textarea ? <Textarea {...controlProps} /> : <Input {...controlProps} />}
      {status === "gap" && (
        <p className="mt-[7px] flex items-center gap-[7px] text-[12.5px] text-amber-fg">
          <span aria-hidden="true">⚠</span> {gapHint}
        </p>
      )}
    </div>
  )
}

const ChipGroup = ({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: BriefOption[]
  selected: string
  onSelect: (value: string) => void
}) => (
  <fieldset>
    <legend className="mb-2.5 block w-full font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
      {label}
    </legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
          className={chipClass(selected === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
)

export const BriefForm = () => {
  const router = useRouter()
  const createSimulation = useMutation(api.simulations.create)
  const analyzeSimulation = useAction(api.simulations.analyze)
  const extractBrief = useAction(api.simulations.extractBrief)
  const extractUpload = useAction(api.ingest.extractUpload)
  const generateUploadUrl = useMutation(api.materials.generateUploadUrl)
  const deckInputRef = useRef<HTMLInputElement>(null)
  const materialsInputRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>({ step: "invite" })
  const [recorderTake, setRecorderTake] = useState(0)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [ideaName, setIdeaName] = useState("")
  const [description, setDescription] = useState("")
  const [whyNow, setWhyNow] = useState("")
  const [stage, setStage] = useState("")
  const [businessModel, setBusinessModel] = useState("")
  const [targetUser, setTargetUser] = useState("")
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)

  // Intra-stage view changes need deliberate focus; route-level focus is
  // FlowShell's job.
  useEffect(() => {
    viewRef.current?.focus()
  }, [phase.step])

  const handleStartOver = () => {
    setPhase({ step: "invite" })
    setInviteError(null)
    setIdeaName("")
    setDescription("")
    setWhyNow("")
    setStage("")
    setBusinessModel("")
    setTargetUser("")
    setFocusAreas([])
    setUploads([])
    setSubmitFailed(false)
  }

  const assembleFrom = (extraction: ExtractedBrief | null, sourceLabel: string, eyebrow: string) => {
    setIdeaName(extraction?.ideaName ?? "")
    setDescription(extraction?.description ?? "")
    setWhyNow(extraction?.whyNow ?? "")
    setStage(extraction?.stage ?? (extraction ? "" : "idea"))
    setBusinessModel(extraction?.businessModel ?? "")
    setTargetUser(extraction?.targetUser ?? "")
    setPhase({ step: "assembled", extraction, sourceLabel, eyebrow })
  }

  const runExtraction = async (pitch: string, origin: PitchOrigin) => {
    setPhase({ step: "drafting", origin, pitch, failed: false })
    try {
      const extraction = await extractBrief({ pitch, source: origin.kind })
      assembleFrom(
        extraction,
        origin.kind === "voice"
          ? `From your ${formatElapsed(0, origin.seconds * 1000)} pitch`
          : `From ${origin.fileName}`,
        origin.kind === "voice" ? "Extracted from your pitch" : "Drafted from your deck"
      )
    } catch {
      setPhase({ step: "drafting", origin, pitch, failed: true })
    }
  }

  const handleDeckPicked = async (file: File | undefined) => {
    if (!file) return
    const rejection = validateMaterialFile(file.name, file.size)
    if (rejection) {
      setInviteError(REJECTION_MESSAGES[rejection])
      return
    }
    setInviteError(null)
    const origin: PitchOrigin = { kind: "deck", fileName: file.name }
    setPhase({ step: "drafting", origin, pitch: "", failed: false })
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!response.ok) throw new Error()
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      const result = await extractUpload({ storageId, name: file.name })
      if (!result.ok) {
        setInviteError(result.reason)
        setPhase({ step: "invite" })
        return
      }
      setUploads([
        { key: crypto.randomUUID(), name: file.name, size: file.size, state: "ready", storageId },
      ])
      await runExtraction(result.text, origin)
    } catch {
      setInviteError("Couldn't read your deck. Check your connection and try again.")
      setPhase({ step: "invite" })
    }
  }

  const uploadFile = async (key: string, file: File) => {
    const fail = (reason: string) =>
      setUploads((prev) =>
        prev.map((entry) =>
          entry.key === key
            ? { key, name: file.name, size: file.size, state: "rejected", reason }
            : entry
        )
      )
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!response.ok) return fail("Upload failed. Try again.")
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      setUploads((prev) =>
        prev.map((entry) =>
          entry.key === key
            ? { key, name: file.name, size: file.size, state: "ready", storageId }
            : entry
        )
      )
    } catch {
      fail("Upload failed. Check your connection and try again.")
    }
  }

  const handleMaterialsAdded = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const key = crypto.randomUUID()
      const rejection = validateMaterialFile(file.name, file.size)
      if (rejection) {
        setUploads((prev) => [
          ...prev,
          { key, name: file.name, size: file.size, state: "rejected", reason: REJECTION_MESSAGES[rejection] },
        ])
        continue
      }
      setUploads((prev) => [...prev, { key, name: file.name, size: file.size, state: "uploading" }])
      uploadFile(key, file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaName || !description) return
    setIsSubmitting(true)
    setSubmitFailed(false)

    const readyMaterials = uploads.flatMap((entry) =>
      entry.state === "ready"
        ? [{ storageId: entry.storageId, name: entry.name, size: entry.size }]
        : []
    )

    try {
      const id = await createSimulation({
        title: ideaName,
        roomType: "investor_panel",
        brief: {
          ideaName,
          stage: optionLabel(STAGE_OPTIONS, stage),
          description,
          targetUser: optionLabel(TARGET_OPTIONS, targetUser),
          businessModel: optionLabel(BUSINESS_MODEL_OPTIONS, businessModel),
          whyNow: whyNow.trim() ? whyNow.trim() : undefined,
          focusAreas,
        },
        materials: readyMaterials.length > 0 ? readyMaterials : undefined,
      })
      router.push(`/simulation/${id}/analyze`)
      analyzeSimulation({ id })
    } catch {
      setSubmitFailed(true)
      setIsSubmitting(false)
    }
  }

  const isUploading = uploads.some((entry) => entry.state === "uploading")

  const fieldStatus = (
    extraction: ExtractedBrief | null,
    key: "ideaName" | "description" | "whyNow",
    value: string
  ): "extracted" | "gap" | null => {
    if (!extraction) return null
    if (extraction[key] !== null) return "extracted"
    return value.trim() === "" ? "gap" : null
  }

  return (
    <div ref={viewRef} tabIndex={-1} className="mx-auto flex min-h-[70vh] w-full max-w-[760px] flex-col outline-none">
      {phase.step === "invite" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[.2em] text-on-surface-3">
            New stress test
          </p>
          <h1 className="font-display text-[clamp(48px,8vw,84px)] font-bold leading-[.98] tracking-[-.02em]">
            Pitch it.
          </h1>
          <p className="mx-auto mb-[46px] mt-[18px] max-w-[40ch] text-lg leading-[1.5] text-on-surface-2">
            Talk it through like you&apos;re in the room. We&apos;ll shape it into a
            brief. No blank page to fill.
          </p>

          <button
            type="button"
            aria-label="Start pitching by voice"
            onClick={() => setPhase({ step: "capturing", guided: false })}
            className="focus-ring group relative mb-[22px] h-[132px] w-[132px] rounded-full"
          >
            <span aria-hidden="true" className="absolute inset-0 animate-ring rounded-full border border-red" />
            <span aria-hidden="true" className="absolute inset-0 animate-ring rounded-full border border-red [animation-delay:.8s]" />
            <span aria-hidden="true" className="absolute inset-0 animate-ring rounded-full border border-red [animation-delay:1.6s]" />
            <span className="absolute inset-[26px] flex items-center justify-center rounded-full bg-on-surface transition-colors group-hover:bg-red">
              <Mic aria-hidden="true" className="h-[34px] w-[34px] text-surface" />
            </span>
          </button>
          <p className="font-display text-xl font-bold tracking-[-.01em]">Start pitching</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-3">
            About a minute is plenty
          </p>

          <div className="mt-11 flex flex-wrap items-center justify-center">
            <button
              type="button"
              onClick={() => assembleFrom(null, "Typing from scratch", "Fill it in, three quick fields")}
              className="focus-ring flex items-center gap-2 border-r border-line-2 px-5 font-mono text-xs uppercase tracking-[.04em] text-on-surface-2 transition-colors hover:text-red-fg"
            >
              <Keyboard aria-hidden="true" className="h-[15px] w-[15px]" /> Type it instead
            </button>
            <button
              type="button"
              onClick={() => deckInputRef.current?.click()}
              className="focus-ring flex items-center gap-2 border-r border-line-2 px-5 font-mono text-xs uppercase tracking-[.04em] text-on-surface-2 transition-colors hover:text-red-fg"
            >
              <Upload aria-hidden="true" className="h-[15px] w-[15px]" /> Upload a deck
            </button>
            <button
              type="button"
              onClick={() => setPhase({ step: "capturing", guided: true })}
              className="focus-ring flex items-center gap-2 px-5 font-mono text-xs uppercase tracking-[.04em] text-on-surface-2 transition-colors hover:text-red-fg"
            >
              <Mic aria-hidden="true" className="h-[15px] w-[15px]" /> Guide me with questions
            </button>
          </div>
          <input
            ref={deckInputRef}
            type="file"
            accept=".pdf,.pptx,.xlsx,.docx"
            className="sr-only"
            aria-label="Upload a deck"
            onChange={(e) => {
              handleDeckPicked(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          {inviteError && (
            <p role="alert" className="mt-6 text-[13px] text-red-fg">
              {inviteError}
            </p>
          )}
        </div>
      )}

      {phase.step === "capturing" && (
        <PitchRecorder
          key={recorderTake}
          guided={phase.guided}
          onComplete={(transcript, seconds) => runExtraction(transcript, { kind: "voice", seconds })}
          onCancel={() => setPhase({ step: "invite" })}
          onRetry={() => setRecorderTake((n) => n + 1)}
        />
      )}

      {phase.step === "drafting" && (
        <div className="flex flex-1 flex-col items-start justify-center">
          {phase.failed ? (
            <>
              <p role="alert" className="max-w-[44ch] text-[17px] leading-[1.5] text-on-surface">
                We couldn&apos;t shape that into a brief. Your pitch is safe; try again.
              </p>
              <div className="mt-7 flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => runExtraction(phase.pitch, phase.origin)}
                  className={FLOW_BTN}
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
                >
                  Start over
                </button>
              </div>
            </>
          ) : (
            <p aria-live="polite" className="flex items-center gap-2.5 text-[17px] text-on-surface-2">
              {phase.origin.kind === "voice" ? "Shaping your pitch into a brief…" : "Reading your deck…"}
              <span aria-hidden="true" className="inline-block h-[15px] w-[7px] animate-blink bg-red" />
            </p>
          )}
        </div>
      )}

      {phase.step === "assembled" && (
        <form onSubmit={handleSubmit}>
          <p className="mb-[18px] font-mono text-[10.5px] uppercase tracking-[.2em] text-on-surface-3">
            {phase.eyebrow}
          </p>
          <h1 className="font-display text-[clamp(34px,4.4vw,52px)] font-bold leading-[.98] tracking-[-.02em]">
            Here&apos;s your brief.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.5] text-on-surface-2">
            Edit anything, fill the gaps we flagged, and you&apos;re set. Nothing here
            is invented — if we didn&apos;t hear it, we ask.
          </p>

          <p className="my-6 inline-flex items-center gap-2 border border-line-2 bg-surface-raised px-[13px] py-2 font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2">
            {phase.sourceLabel}
          </p>

          <BriefField
            id="ideaName"
            label="Idea name"
            value={ideaName}
            onChange={setIdeaName}
            placeholder="e.g. Cartograph"
            gapHint="We didn't catch a name. What do you call it?"
            status={fieldStatus(phase.extraction, "ideaName", ideaName)}
            required
          />
          <BriefField
            id="description"
            label="What it is"
            value={description}
            onChange={setDescription}
            placeholder="What it does, who it's for, in a couple of lines"
            gapHint="We didn't catch what it is. One or two lines."
            status={fieldStatus(phase.extraction, "description", description)}
            textarea
            controlClassName="min-h-[80px] p-4 text-[15.5px] leading-[1.5]"
            required
          />
          <BriefField
            id="whyNow"
            label="Why now"
            value={whyNow}
            onChange={setWhyNow}
            placeholder="What changed that makes now the moment"
            gapHint="We didn't catch this in your pitch. What changed that makes this urgent?"
            status={fieldStatus(phase.extraction, "whyNow", whyNow)}
            textarea
            controlClassName="min-h-[52px] p-4 text-[15.5px] leading-[1.5]"
          />

          <div className="mb-[26px] flex flex-col gap-5">
            <ChipGroup label="Stage" options={STAGE_OPTIONS} selected={stage} onSelect={setStage} />
            <ChipGroup
              label="Business model"
              options={BUSINESS_MODEL_OPTIONS}
              selected={businessModel}
              onSelect={setBusinessModel}
            />
            <ChipGroup
              label="Target user"
              options={TARGET_OPTIONS}
              selected={targetUser}
              onSelect={setTargetUser}
            />
          </div>

          <fieldset className="mb-[26px] border-t border-line pt-6">
            <legend className="mb-2.5 block w-full font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
              The one thing we should challenge most
            </legend>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((area) => (
                <button
                  key={area}
                  type="button"
                  aria-pressed={focusAreas.includes(area)}
                  onClick={() =>
                    setFocusAreas((prev) =>
                      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
                    )
                  }
                  className={chipClass(focusAreas.includes(area))}
                >
                  {area}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mb-[26px]">
            <p className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
              Materials
              <span className="tracking-[.06em] text-on-surface-3">optional · PDF PPTX XLSX DOCX</span>
            </p>
            <input
              ref={materialsInputRef}
              type="file"
              multiple
              accept=".pdf,.pptx,.xlsx,.docx"
              className="sr-only"
              aria-label="Add materials"
              onChange={(e) => {
                handleMaterialsAdded(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => materialsInputRef.current?.click()}
              className="focus-ring flex w-full items-center gap-2.5 border border-dashed border-line-2 bg-surface-raised px-4 py-3 text-left text-[13px] text-on-surface-2 hover:text-on-surface"
            >
              <Upload aria-hidden="true" className="h-4 w-4 flex-none" />
              Add a deck, model, or one-pager for the audit
            </button>
            {uploads.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-2">
                {uploads.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex items-center gap-2.5 border border-line bg-surface px-[11px] py-[9px] text-[13px]"
                  >
                    <span className="flex-none bg-on-surface px-1.5 py-[2px] font-mono text-[9px] tracking-[.06em] text-surface">
                      {entry.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {entry.state === "uploading" && (
                      <span className="font-mono text-[10px] uppercase text-on-surface-3">Uploading…</span>
                    )}
                    {entry.state === "ready" && (
                      <span className="font-mono text-[10px] uppercase text-on-surface-3">
                        <span aria-hidden="true" className="text-ok">✓</span> {formatSize(entry.size)}
                      </span>
                    )}
                    {entry.state === "rejected" && (
                      <span role="alert" className="text-[11.5px] text-red-fg">
                        {entry.reason}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setUploads((prev) => prev.filter((u) => u.key !== entry.key))}
                      aria-label={`Remove ${entry.name}`}
                      className="focus-ring flex-none text-on-surface-3 hover:text-red-fg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3.5 border-t border-line pt-6">
            <button
              type="submit"
              disabled={isSubmitting || isUploading || !ideaName || !description}
              className={FLOW_BTN}
            >
              {isSubmitting
                ? "Starting the read…"
                : isUploading
                  ? "Waiting for uploads…"
                  : "Read my brief"}
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={handleStartOver}
              className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-red-fg"
            >
              Start over
            </button>
          </div>
          {submitFailed && (
            <p role="alert" className="mt-3 text-[13px] text-red-fg">
              Couldn&apos;t start the stress test. Check your connection and try again.
            </p>
          )}
        </form>
      )}
    </div>
  )
}
