"use client"

import { useEffect } from "react"
import { ArrowRight, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import type { DomainPack, Scope } from "@/domains/types"
import type { IntakeFormAction, IntakeFormState } from "@/lib/intakeForm"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { ScopeFields } from "./ScopeFields"
import { BriefPreview, EvidenceRail } from "./BriefPreview"
import { UploadList, useMaterialUploads } from "./materialUploads"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"
import { firstNameOf } from "@/domains/types"

export const ctaLabel = (pack: DomainPack): string =>
  pack.personas.length > 1 ? "Choose your panel" : `Meet ${firstNameOf(pack.personas[0].name)}`

export const ctaHint = (pack: DomainPack): string =>
  pack.personas.length > 1
    ? "Three panelists. We'll recommend who to face first."
    : `${firstNameOf(pack.personas[0].name)} reads everything before the first question.`

export const missingRequired = (pack: DomainPack, scope: Scope): string[] =>
  pack.scopeFields
    .filter((field) => {
      if (!field.required) return false
      const value = scope[field.key]
      return typeof value === "string" ? value.trim().length === 0 : !value
    })
    .map((field) => field.key)

const SectionHead = ({ title, meta }: { title: string; meta?: string }) => (
  <div className="mb-5 flex items-baseline gap-3">
    <h2 className="flex-none text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-2">
      {title}
    </h2>
    {meta && (
      <span className="flex-none font-mono text-[10.5px] tracking-[.02em] text-ink-4 max-md:min-w-0 max-md:flex-1 max-md:truncate">
        {meta}
      </span>
    )}
    <span aria-hidden="true" className="h-px flex-1 self-center bg-line max-md:hidden" />
  </div>
)

type TypedFormProps = {
  pack: DomainPack
  // Owned by the page, keyed per lane, so filled fields and markers survive
  // lane switches and mode toggles until the page is left.
  form: IntakeFormState
  dispatch: (action: IntakeFormAction) => void
  uploads: ReturnType<typeof useMaterialUploads>
  submitting: boolean
  submitError: string | null
  onSubmit: (scope: Scope) => void
}

// The structured typed path: same fields the voice path extracts into,
// grouped into the pack's sections, with the reader's live preview beside
// them. Materials lead the form — an uploaded deck fills whatever untouched
// fields it actually states (ingest.scopeFromUpload, the honesty-ruled
// extraction). The viewport stays fixed: the form column is the scroll
// container, the rail stands still. Skips the confirm beat — the user is
// the source.
export const TypedForm = ({
  pack,
  form,
  dispatch,
  uploads,
  submitting,
  submitError,
  onSubmit,
}: TypedFormProps) => {
  const scopeFromUpload = useAction(api.ingest.scopeFromUpload)
  const formScroll = useAutoHideScrollbar<HTMLDivElement>()
  const railScroll = useAutoHideScrollbar<HTMLElement>()
  const fieldsByKey = new Map(pack.scopeFields.map((field) => [field.key, field]))

  // Autofill synchronizes with the upload transport: each upload that
  // reaches storage gets one extraction run, deduped by the lane state's
  // extracted list (readStart is idempotent), so a re-mounted form can't
  // re-read a processed upload. Late responses are safe by construction —
  // the merge only ever fills still-empty, untouched fields.
  useEffect(() => {
    for (const material of uploads.readyMaterials) {
      if (form.extracted.includes(material.storageId)) continue
      dispatch({ type: "readStart", storageId: material.storageId, fileName: material.name })
      scopeFromUpload({
        storageId: material.storageId,
        fileName: material.name,
        packId: pack.id,
      })
        .then((extracted) =>
          dispatch({
            type: "autofill",
            storageId: material.storageId,
            fileName: material.name,
            extracted,
          })
        )
        .catch(() =>
          dispatch({
            type: "readFailed",
            storageId: material.storageId,
            fileName: material.name,
          })
        )
    }
  }, [uploads.readyMaterials, form.extracted, dispatch, scopeFromUpload, pack.id])

  const previewScope: Scope = Object.fromEntries(
    Object.entries(form.scope).filter(([key]) => {
      const kind = fieldsByKey.get(key)?.kind
      return kind === "chips" || kind === "multi" || form.committed.has(key)
    })
  )

  const handleSubmit = () => {
    const gaps = missingRequired(pack, form.scope)
    if (gaps.length > 0) return dispatch({ type: "setMissing", keys: gaps })
    onSubmit(form.scope)
  }

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-[1060px] flex-1 grid-cols-[minmax(0,1fr)_360px] items-start gap-x-14 max-lg:grid-cols-1">
      {/* The focus ring draws 4px outside each control; the scroller pads
          by that much (offset by margin) so it never clips the ring. */}
      <div
        ref={formScroll}
        className="scrollbar-subtle -ml-1.5 -mt-1.5 h-full min-h-0 overflow-y-auto overscroll-contain pb-16 pl-1.5 pr-2 pt-1.5 max-lg:h-auto max-lg:overflow-visible"
      >
          <section className="mb-10">
            <SectionHead title={pack.copy.form.materialsTitle} meta={pack.copy.form.materialsMeta} />
            {/* Two fixed lines in every lane: the lane's own noun on top,
                the uniform behavior line beneath — never one line here and
                two there depending on copy length. */}
            <label className="focus-ring flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border-[1.5px] border-dashed border-line-2 bg-surface-raised px-4 py-3.5 shadow-card transition-colors hover:border-accent-line hover:bg-surface-2">
              <span className="flex items-center gap-2.5 text-[13.5px] font-medium text-on-surface-2">
                <Upload className="size-[15px]" />
                {pack.copy.form.materialsPrompt}
              </span>
              <span className="text-[12px] text-on-surface-3">
                {pack.personas.length > 1
                  ? "Your panel reads"
                  : `${firstNameOf(pack.personas[0].name)} reads`}{" "}
                everything before the session and fills in what it can below.
              </span>
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
            <UploadList uploads={uploads.uploads} onRemove={uploads.removeUpload} />
            <div role="status" className="mt-2.5 space-y-1.5 text-[12.5px] text-on-surface-3">
              {form.reading.map((entry) => (
                <p key={entry.storageId} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-blue"
                  />
                  Reading {entry.fileName} to fill in what it can…
                </p>
              ))}
              {form.notice &&
                form.reading.length === 0 &&
                (form.notice.filled ? (
                  <p className="rounded-lg border border-accent-line bg-accent-bg px-3 py-2 text-accent-blue">
                    {form.notice.text}
                  </p>
                ) : (
                  <p>{form.notice.text}</p>
                ))}
            </div>
          </section>

          {pack.copy.form.sections.map((section) => (
            <section key={section.title} className="mb-10">
              <SectionHead title={section.title} meta={section.meta} />
              <div className="space-y-6">
                <ScopeFields
                  pack={pack}
                  fields={section.keys.flatMap((key) => {
                    const field = fieldsByKey.get(key)
                    return field ? [field] : []
                  })}
                  scope={form.scope}
                  missingKeys={form.missingKeys}
                  inferredKeys={form.inferred}
                  plainLabels
                  showEvidence={false}
                  onChange={(key, value) => dispatch({ type: "change", key, value })}
                  onFieldBlur={(key) => dispatch({ type: "blur", key })}
                />
              </div>
            </section>
          ))}

          {pack.evidenceRequests && (
            <div className="mb-10 lg:hidden">
              <EvidenceRail pack={pack} scope={form.scope} />
            </div>
          )}

          {form.missingKeys.length > 0 && (
            <p role="alert" className="mb-4 text-[13px] text-red-fg">
              Fill in the highlighted fields to continue.
            </p>
          )}
          {submitError && (
            <p role="alert" className="mb-4 text-[13px] text-red-fg">
              {submitError}
            </p>
          )}

          <div className="flex items-center gap-3.5 max-md:flex-col max-md:items-stretch max-md:gap-2.5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploads.isUploading}
              className={cn(BTN_PRIMARY, "flex-none max-md:justify-center")}
            >
              {submitting ? "Setting up" : ctaLabel(pack)}
              <ArrowRight className="size-3.5" />
            </button>
            <span className="text-[12.5px] text-on-surface-3">{ctaHint(pack)}</span>
          </div>
        </div>

      <aside ref={railScroll} className="scrollbar-subtle hidden max-h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-8 lg:block">
        {/* The preview mirrors the form the user is already filling —
            duplicate content for screen readers, so hidden from them. */}
        <div aria-hidden="true">
          <BriefPreview pack={pack} scope={previewScope} />
        </div>
        <EvidenceRail pack={pack} scope={previewScope} />
      </aside>
    </div>
  )
}
