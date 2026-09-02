"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Pencil, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DomainPack, Scope, ScopeValue } from "@/domains/types"
import { scopeText } from "@/domains/types"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { ScopeFields, FIELD_INPUT } from "./ScopeFields"
import { ctaHint, missingRequired } from "./TypedForm"
import { UploadList, useMaterialUploads } from "./materialUploads"
import { firstNameOf } from "@/domains/types"

type ConfirmBriefProps = {
  pack: DomainPack
  heard: Scope
  seconds: number
  uploads: ReturnType<typeof useMaterialUploads>
  submitting: boolean
  submitError: string | null
  onSubmit: (scope: Scope) => void
  onBack: () => void
}

// Beat 2 of the voice path: what the extraction actually heard, gaps
// flagged, everything editable. Only what was said made it in — a gap is a
// finding, not a failure.
export const ConfirmBrief = ({
  pack,
  heard,
  seconds,
  uploads,
  submitting,
  submitError,
  onSubmit,
  onBack,
}: ConfirmBriefProps) => {
  const [scope, setScope] = useState<Scope>(heard)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  const textFields = pack.scopeFields.filter(
    (field) => field.kind === "text" || field.kind === "textarea"
  )
  const chipFields = pack.scopeFields.filter(
    (field) => field.kind === "chips" || field.kind === "multi"
  )

  const handleChange = (key: string, value: ScopeValue) => {
    setScope((prev) => ({ ...prev, [key]: value }))
    setMissing((prev) => prev.filter((k) => k !== key))
  }

  const handleSubmit = () => {
    const gaps = missingRequired(pack, scope)
    if (gaps.length > 0) {
      setMissing(gaps)
      const firstText = textFields.find((field) => gaps.includes(field.key))
      if (firstText) setEditingKey(firstText.key)
      return
    }
    onSubmit(scope)
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, "0")

  return (
    <div className="mx-auto max-w-[640px]">
      <button
        type="button"
        onClick={onBack}
        className="focus-ring -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface-2"
      >
        <ArrowLeft className="size-[13px]" />
        Change what you said
      </button>

      <p className="mb-1 font-mono text-[11px] uppercase tracking-[.03em] text-on-surface-3">
        From your recording · {minutes}:{remainder}
      </p>
      <h1 className="text-[20px] font-semibold tracking-[-.018em]">Here&apos;s what we heard</h1>
      <p className="mb-[22px] mt-1.5 text-[13.5px] leading-relaxed text-on-surface-2">
        Only what you actually said made it in. Fill or leave the gaps. A gap is a finding, not
        a failure.
      </p>

      <div className="mb-6 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
        {textFields.map((field) => {
          const value = scopeText(scope, field.key)
          const isMissing = value.trim().length === 0
          const editing = editingKey === field.key
          return (
            <div
              key={field.key}
              className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "mb-0.5 text-[10.5px] font-semibold uppercase tracking-[.08em]",
                    missing.includes(field.key) ? "text-red-fg" : "text-on-surface-3"
                  )}
                >
                  {field.label}
                </p>
                {editing ? (
                  <input
                    autoFocus
                    type="text"
                    value={value}
                    maxLength={field.maxLength}
                    placeholder={field.placeholder}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(event) => event.key === "Enter" && setEditingKey(null)}
                    className={cn(FIELD_INPUT, "px-2.5 py-1.5 text-[13.5px]")}
                  />
                ) : (
                  <p className={cn("text-[13.5px] leading-snug", isMissing && "text-ink-4")}>
                    {isMissing ? "You didn't mention this" : value}
                  </p>
                )}
              </div>
              {isMissing && !editing && (
                <span className="flex-none whitespace-nowrap rounded-full border border-warn-line bg-warn-bg px-2.5 py-[3px] text-[10.5px] font-semibold text-warn">
                  Not heard
                </span>
              )}
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditingKey(field.key)}
                  aria-label={`Edit ${field.label}`}
                  className="focus-ring flex-none rounded-md p-1.5 text-ink-4 transition-colors hover:bg-surface-2 hover:text-on-surface-2 max-md:-m-1.5 max-md:p-3"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <ScopeFields
        pack={pack}
        fields={chipFields}
        scope={scope}
        missingKeys={missing}
        onChange={handleChange}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-on-surface-3">
          {pack.personas.length > 1
            ? "Your panel reads these before the session:"
            : `${firstNameOf(pack.personas[0].name)} reads these before the session:`}
        </span>
        <label className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 py-1 text-xs text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-accent-blue">
          <Upload className="size-[11px]" />
          Add
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.xlsx,.docx"
            className="sr-only"
            onChange={(event) => {
              uploads.addFiles(event.target.files)
              event.target.value = ""
            }}
          />
        </label>
      </div>
      <UploadList uploads={uploads.uploads} onRemove={uploads.removeUpload} />

      {missing.length > 0 && (
        <p role="alert" className="mt-4 text-[13px] text-red-fg">
          Fill in the flagged fields to continue.
        </p>
      )}
      {submitError && (
        <p role="alert" className="mt-4 text-[13px] text-red-fg">
          {submitError}
        </p>
      )}

      <div className="mt-7 flex items-center gap-3.5 max-md:flex-col max-md:items-stretch max-md:gap-2.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploads.isUploading}
          className={cn(BTN_PRIMARY, "flex-none max-md:justify-center")}
        >
          {submitting
            ? "Setting up"
            : pack.personas.length > 1
              ? "Looks right, choose your panel"
              : `Looks right, meet ${firstNameOf(pack.personas[0].name)}`}
          <ArrowRight className="size-3.5" />
        </button>
        <span className="text-[12.5px] text-on-surface-3">{ctaHint(pack)}</span>
      </div>
    </div>
  )
}
