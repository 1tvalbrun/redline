"use client"

import { cn } from "@/lib/utils"
import type { DomainPack, Scope, ScopeField, ScopeValue } from "@/domains/types"
import { scopeList, scopeText } from "@/domains/types"
import { EvidenceSection } from "./BriefPreview"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

export const FIELD_INPUT =
  "focus-ring w-full rounded-[11px] border border-line-2 bg-surface-raised px-3.5 py-[11px] text-sm text-on-surface placeholder:text-ink-4 transition-colors focus:border-accent-line max-md:text-[16px]"

export const FieldLabel = ({
  children,
  optional,
  plain,
  className,
}: {
  children: React.ReactNode
  optional?: boolean
  // Sentence-case label for the sectioned form; the uppercase micro-label
  // stays for dense card contexts (confirm rows).
  plain?: boolean
  className?: string
}) => (
  <p
    className={cn(
      "flex items-baseline justify-between max-md:flex-wrap max-md:gap-x-2",
      plain
        ? "mb-2 text-sm font-medium text-on-surface"
        : "mb-2 mt-[22px] text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3 first:mt-0",
      className
    )}
  >
    {children}
    {optional && <span className="font-mono text-[10.5px] font-normal normal-case tracking-[.02em] text-ink-4">optional</span>}
  </p>
)

export const Chip = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      "focus-ring rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors max-md:py-2.5",
      selected
        ? "border-accent-line bg-accent-bg font-medium text-accent-blue"
        : "border-line-2 bg-surface-raised text-on-surface-2 hover:bg-surface-2"
    )}
  >
    {children}
  </button>
)

// What a real assessor asks to see for the chosen area — rendered the
// moment the driving chip field has a value (only the audit pack declares
// evidenceRequests).
export const EvidencePanel = ({ pack, scope }: { pack: DomainPack; scope: Scope }) => {
  const listScroll = useAutoHideScrollbar<HTMLDivElement>()
  const sections = pack.evidenceRequests?.(scope) ?? []
  if (sections.length === 0) return null
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-raised px-[18px] py-4 shadow-card">
      <p className="text-[12.5px] font-semibold">What the assessor will ask for</p>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-normal text-on-surface-3">
        Gather what you can. Anything missing becomes a finding in the pre-read, not a surprise
        in the room.
      </p>
      <div ref={listScroll} className="scrollbar-subtle max-h-[320px] space-y-2.5 overflow-y-auto overscroll-contain pr-1.5">
        {sections.map((section) => (
          <EvidenceSection key={section.title} title={section.title} items={section.items} />
        ))}
      </div>
    </div>
  )
}

type ScopeFieldsProps = {
  pack: DomainPack
  fields: ScopeField[]
  scope: Scope
  missingKeys?: string[]
  // Fields whose value came from a deck extraction, not the user — marked
  // for review until the user edits them.
  inferredKeys?: ReadonlySet<string>
  plainLabels?: boolean
  // The sectioned form shows the evidence list in its rail instead.
  showEvidence?: boolean
  onChange: (key: string, value: ScopeValue) => void
  // Fires when a text field loses focus — the preview rail commits then,
  // not per keystroke.
  onFieldBlur?: (key: string) => void
}

// The one field renderer both intake paths share: text, textarea,
// single-select chips, multi-select chips, plus the evidence panel after a
// chips field when the pack declares one.
export const ScopeFields = ({
  pack,
  fields,
  scope,
  missingKeys,
  inferredKeys,
  plainLabels,
  showEvidence = true,
  onChange,
  onFieldBlur,
}: ScopeFieldsProps) => (
  <>
    {fields.map((scopeField) => {
      const missing = missingKeys?.includes(scopeField.key)
      const label = (
        <FieldLabel
          optional={!scopeField.required && scopeField.kind !== "multi"}
          plain={plainLabels}
          className={cn(missing && "text-red-fg")}
        >
          <span className="flex items-baseline gap-2 max-md:flex-wrap">
            {scopeField.label}
            {inferredKeys?.has(scopeField.key) && (
              <span className="rounded-full border border-accent-line bg-accent-bg px-2 py-px font-mono text-[9.5px] font-medium uppercase tracking-[.05em] text-accent-blue">
                from your deck · check this
              </span>
            )}
          </span>
        </FieldLabel>
      )
      if (scopeField.kind === "text" || scopeField.kind === "textarea") {
        const shared = {
          value: scopeText(scope, scopeField.key),
          placeholder: scopeField.placeholder,
          maxLength: scopeField.maxLength,
          "aria-invalid": missing || undefined,
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
          ) => onChange(scopeField.key, event.target.value),
          onBlur: () => onFieldBlur?.(scopeField.key),
        }
        return (
          <label key={scopeField.key} className="block">
            {label}
            {scopeField.kind === "textarea" ? (
              <textarea {...shared} rows={3} className={cn(FIELD_INPUT, "resize-y")} />
            ) : (
              <input {...shared} type="text" className={FIELD_INPUT} />
            )}
          </label>
        )
      }
      const selected =
        scopeField.kind === "multi"
          ? scopeList(scope, scopeField.key)
          : [scopeText(scope, scopeField.key)]
      return (
        <div key={scopeField.key}>
          {label}
          <div className="flex flex-wrap gap-2" role="group" aria-label={scopeField.label}>
            {(scopeField.options ?? []).map((option) => {
              const isOn = selected.includes(option.label)
              const handleToggle = () =>
                scopeField.kind === "multi"
                  ? onChange(
                      scopeField.key,
                      isOn
                        ? selected.filter((item) => item !== option.label)
                        : [...selected, option.label]
                    )
                  : onChange(scopeField.key, isOn ? "" : option.label)
              return (
                <Chip key={option.value} selected={isOn} onClick={handleToggle}>
                  {option.label}
                </Chip>
              )
            })}
          </div>
          {scopeField.kind === "chips" && showEvidence && (
            <EvidencePanel pack={pack} scope={scope} />
          )}
        </div>
      )
    })}
  </>
)
