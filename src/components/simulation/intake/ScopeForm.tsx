"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useAction } from "convex/react"
import { Upload } from "lucide-react"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { scopeText, type DomainPack, type Scope, type ScopeField } from "@/domains/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FLOW_BTN } from "@/components/simulation/flow/FlowShell"
import { UploadList, useMaterialUploads } from "./materialUploads"

const chipClass = (active: boolean) =>
  cn(
    "focus-ring border px-[13px] py-2 font-mono text-[11px] uppercase tracking-[.04em] transition-colors",
    active
      ? "border-on-surface bg-on-surface text-surface"
      : "border-line-2 bg-surface-raised text-on-surface-2 hover:text-on-surface"
  )

const FieldLabel = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label
    htmlFor={htmlFor}
    className="mb-2 block font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2"
  >
    {children}
  </label>
)

// The declarative intake: renders any pack's scopeFields as a form. Lanes
// with a bespoke intake (the founder's voice pitch) ship their own
// component instead; everything else goes through here.
export const ScopeForm = ({ pack }: { pack: DomainPack }) => {
  const router = useRouter()
  const createSimulation = useMutation(api.simulations.create)
  const analyzeSimulation = useAction(api.simulations.analyze)
  const { uploads, addFiles, removeUpload, readyMaterials, isUploading } = useMaterialUploads()
  const materialsInputRef = useRef<HTMLInputElement>(null)

  const [scope, setScope] = useState<Scope>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)

  const intake = pack.copy.intake
  if (!intake) {
    return (
      <p role="alert" className="text-[13.5px] text-red-fg">
        This lane&apos;s intake isn&apos;t configured yet.
      </p>
    )
  }

  const setValue = (key: string, value: string) =>
    setScope((prev) => ({ ...prev, [key]: value }))

  const toggleMulti = (key: string, value: string) =>
    setScope((prev) => {
      const current = prev[key]
      const list = Array.isArray(current) ? current : []
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      }
    })

  const missingRequired = pack.scopeFields.some(
    (field) => field.required && scopeText(scope, field.key).trim() === ""
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (missingRequired || isSubmitting) return
    setIsSubmitting(true)
    setSubmitFailed(false)
    try {
      const id = await createSimulation({
        packId: pack.id,
        scope,
        materials: readyMaterials.length > 0 ? readyMaterials : undefined,
      })
      router.push(`/simulation/${id}/analyze`)
      // Fire-and-forget past navigation: on failure analyze reverts the
      // simulation to draft, and the Read stage's watchdog offers retry.
      analyzeSimulation({ id }).catch(() => {})
    } catch {
      setSubmitFailed(true)
      setIsSubmitting(false)
    }
  }

  const renderField = (field: ScopeField) => {
    if (field.kind === "chips" || field.kind === "multi") {
      const selected = field.kind === "chips" ? scopeText(scope, field.key) : null
      const list = field.kind === "multi" ? scope[field.key] : null
      return (
        <fieldset key={field.key} className="mb-5">
          <legend className="mb-2.5 block w-full font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
            {field.label}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((option) => {
              const active =
                field.kind === "chips"
                  ? selected === option.label
                  : Array.isArray(list) && list.includes(option.label)
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    field.kind === "chips"
                      ? setValue(field.key, active ? "" : option.label)
                      : toggleMulti(field.key, option.label)
                  }
                  className={chipClass(active)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      )
    }

    const controlProps = {
      id: field.key,
      value: scopeText(scope, field.key),
      placeholder: field.placeholder,
      required: field.required,
      maxLength: field.maxLength,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValue(field.key, e.target.value),
      className: "bg-surface-raised",
    }
    return (
      <div key={field.key} className="mb-5">
        <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
        {field.kind === "textarea" ? (
          <Textarea {...controlProps} className="min-h-[80px] bg-surface-raised p-4 text-[15.5px] leading-[1.5]" />
        ) : (
          <Input {...controlProps} />
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[760px]">
      <p className="mb-[18px] font-mono text-[10.5px] uppercase tracking-[.2em] text-on-surface-3">
        {intake.kicker}
      </p>
      <h1 className="font-display text-[clamp(34px,4.4vw,52px)] font-bold leading-[.98] tracking-[-.02em]">
        {intake.heading}
      </h1>
      <p className="mb-8 mt-4 max-w-[52ch] text-[17px] leading-[1.5] text-on-surface-2">
        {intake.lead}
      </p>

      {pack.scopeFields.map(renderField)}

      <div className="mb-[26px]">
        <p className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[.14em] text-on-surface-2">
          {intake.materialsLabel}
          <span className="tracking-[.06em] text-on-surface-3">optional · PDF PPTX XLSX DOCX</span>
        </p>
        <input
          ref={materialsInputRef}
          type="file"
          multiple
          accept=".pdf,.pptx,.xlsx,.docx"
          className="sr-only"
          aria-label={intake.materialsLabel}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => materialsInputRef.current?.click()}
          className="focus-ring flex w-full items-center gap-2.5 border border-dashed border-line-2 bg-surface-raised px-4 py-3 text-left text-[13px] text-on-surface-2 hover:text-on-surface"
        >
          <Upload aria-hidden="true" className="h-4 w-4 flex-none" />
          {intake.materialsButton}
        </button>
        <UploadList uploads={uploads} onRemove={removeUpload} />
      </div>

      <div className="flex items-center gap-3.5 border-t border-line pt-6">
        <button
          type="submit"
          disabled={isSubmitting || isUploading || missingRequired}
          className={FLOW_BTN}
        >
          {isSubmitting
            ? "Starting the read…"
            : isUploading
              ? "Waiting for uploads…"
              : intake.cta}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {submitFailed && (
        <p role="alert" className="mt-3 text-[13px] text-red-fg">
          Couldn&apos;t start the run. Check your connection and try again.
        </p>
      )}
    </form>
  )
}
