"use client"

import { useState } from "react"
import { ArrowRight, Upload } from "lucide-react"
import type { DomainPack, Scope, ScopeValue } from "@/domains/types"
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
      <span className="flex-none font-mono text-[10.5px] tracking-[.02em] text-ink-4">{meta}</span>
    )}
    <span aria-hidden="true" className="h-px flex-1 self-center bg-line" />
  </div>
)

type TypedFormProps = {
  pack: DomainPack
  initialScope?: Scope
  uploads: ReturnType<typeof useMaterialUploads>
  submitting: boolean
  submitError: string | null
  onSubmit: (scope: Scope) => void
}

// The structured typed path: same fields the voice path extracts into,
// grouped into the pack's sections, with the reader's live preview beside
// them. The viewport stays fixed: the form column is the scroll container,
// the rail stands still. Skips the confirm beat — the user is the source.
export const TypedForm = ({
  pack,
  initialScope,
  uploads,
  submitting,
  submitError,
  onSubmit,
}: TypedFormProps) => {
  const [scope, setScope] = useState<Scope>(initialScope ?? {})
  // Text fields reach the preview rail only once blurred — watching your
  // own keystrokes echo in two places reads uncanny. Chips are always
  // shown, so only text commits need marking; the preview derives from
  // the one scope.
  const [committedKeys, setCommittedKeys] = useState<ReadonlySet<string>>(
    () => new Set(Object.keys(initialScope ?? {}))
  )
  const [missing, setMissing] = useState<string[]>([])
  const formScroll = useAutoHideScrollbar<HTMLDivElement>()
  const railScroll = useAutoHideScrollbar<HTMLElement>()
  const fieldsByKey = new Map(pack.scopeFields.map((field) => [field.key, field]))

  const handleChange = (key: string, value: ScopeValue) => {
    setScope((prev) => ({ ...prev, [key]: value }))
    setMissing((prev) => prev.filter((k) => k !== key))
  }

  const handleFieldBlur = (key: string) => {
    setCommittedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  }

  const previewScope: Scope = Object.fromEntries(
    Object.entries(scope).filter(([key]) => {
      const kind = fieldsByKey.get(key)?.kind
      return kind === "chips" || kind === "multi" || committedKeys.has(key)
    })
  )

  const handleSubmit = () => {
    const gaps = missingRequired(pack, scope)
    if (gaps.length > 0) return setMissing(gaps)
    onSubmit(scope)
  }

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-[1060px] flex-1 grid-cols-[minmax(0,1fr)_360px] items-start gap-x-14 max-lg:grid-cols-1">
      {/* The focus ring draws 4px outside each control; the scroller pads
          by that much (offset by margin) so it never clips the ring. */}
      <div
        ref={formScroll}
        className="scrollbar-subtle -ml-1.5 -mt-1.5 h-full min-h-0 overflow-y-auto overscroll-contain pb-16 pl-1.5 pr-2 pt-1.5"
      >
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
                  scope={scope}
                  missingKeys={missing}
                  plainLabels
                  showEvidence={false}
                  onChange={handleChange}
                  onFieldBlur={handleFieldBlur}
                />
              </div>
            </section>
          ))}

          {pack.evidenceRequests && (
            <div className="mb-10 lg:hidden">
              <EvidenceRail pack={pack} scope={scope} />
            </div>
          )}

          <section className="mb-8">
            <SectionHead title={pack.copy.form.materialsTitle} meta={pack.copy.form.materialsMeta} />
            <label className="focus-ring flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-line-2 px-4 py-3.5 text-[13px] text-on-surface-3 transition-colors hover:border-accent-line hover:bg-surface-2 hover:text-accent-blue">
              <Upload className="size-[15px]" />
              {pack.personas.length > 1
                ? "Add your deck or one-pager. Your panel reads it before the session."
                : `Add your documents. ${firstNameOf(pack.personas[0].name)} reads them before the session.`}
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
          </section>

          {missing.length > 0 && (
            <p role="alert" className="mb-4 text-[13px] text-red-fg">
              Fill in the highlighted fields to continue.
            </p>
          )}
          {submitError && (
            <p role="alert" className="mb-4 text-[13px] text-red-fg">
              {submitError}
            </p>
          )}

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploads.isUploading}
              className={BTN_PRIMARY}
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
