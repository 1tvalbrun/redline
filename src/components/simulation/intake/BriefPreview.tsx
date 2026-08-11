"use client"

import type { DomainPack, Scope } from "@/domains/types"
import { scopeText } from "@/domains/types"
import { personaInitials } from "@/components/shared/PersonaAvatar"

// The reader-over-your-shoulder rail: mirrors the form as the user types,
// derived entirely from the live scope. Empty fields coach instead of
// nagging; the chips row shows what's picked so far.
export const BriefPreview = ({ pack, scope }: { pack: DomainPack; scope: Scope }) => {
  const preview = pack.copy.preview
  const chipValues = preview.chips.keys.flatMap((key) => {
    const value = scope[key]
    return Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []
  })

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-[18px] py-3.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line-2 bg-surface-2 text-[11px] font-semibold text-on-surface-2">
          {personaInitials(pack.personas[0].name)}
        </span>
        <div>
          <p className="text-[13.5px] font-semibold leading-tight">{preview.title}</p>
          <p className="text-xs text-on-surface-3">assembling as you type</p>
        </div>
      </div>

      <div className="px-[18px]">
        {preview.rows.map((row) => {
          const value = scopeText(scope, row.key)
          return (
            <div key={row.key} className="border-b border-line py-3">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                {row.label}
              </p>
              {value ? (
                // Keyed on the value: a fresh commit remounts the line and
                // eases it in rather than snapping.
                <p
                  key={value}
                  className="line-clamp-3 animate-in break-words fade-in-0 slide-in-from-bottom-1 fill-mode-both text-[13px] leading-normal text-on-surface duration-300 motion-reduce:animate-none"
                >
                  {value}
                </p>
              ) : (
                <p className="text-[13px] italic leading-normal text-ink-4">{row.hint}</p>
              )}
            </div>
          )
        })}
        <div className="py-3">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
            {preview.chips.label}
          </p>
          {chipValues.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chipValues.map((value) => (
                <span
                  key={value}
                  className="rounded-full bg-surface-2 px-2.5 py-[3px] text-[11.5px] text-on-surface-2"
                >
                  {value}
                </span>
              ))}
            </div>
          ) : (
            <span className="rounded-full bg-surface-2 px-2.5 py-[3px] text-[11.5px] italic text-ink-4">
              none yet
            </span>
          )}
        </div>
      </div>

      <p className="border-t border-line bg-surface px-[18px] py-3 font-serif text-xs italic leading-relaxed text-on-surface-3">
        {preview.footer}
      </p>
    </div>
  )
}

// One safeguard: its title line, then each piece of evidence the assessor
// requests for it. Shared by the rail and the confirm beat's inline panel.
export const EvidenceSection = ({ title, items }: { title: string; items: string[] }) => (
  <div className="border-t border-line pt-2.5 first:border-t-0 first:pt-0">
    <p className="text-xs font-semibold leading-snug text-on-surface">{title}</p>
    <ul className="mb-2.5 mt-1.5 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-normal text-on-surface-2">
          <span aria-hidden="true" className="mt-[7px] h-1 w-1 flex-none rounded-full bg-ink-4" />
          {item}
        </li>
      ))}
    </ul>
  </div>
)

// Audit-only companion card: the evidence request list lives beside the
// form, not inside it, and fills in the moment a control area is chosen.
// The list scrolls inside the card so a long control area never outgrows
// the rail.
export const EvidenceRail = ({ pack, scope }: { pack: DomainPack; scope: Scope }) => {
  if (!pack.evidenceRequests) return null
  const sections = pack.evidenceRequests(scope)
  return (
    <div className="rounded-xl border border-line bg-surface-raised px-[18px] py-4 shadow-card">
      <p className="text-[13.5px] font-semibold">What the assessor will ask for</p>
      {sections.length === 0 ? (
        <>
          <p className="mt-1 text-[12.5px] leading-normal text-on-surface-3">
            Pick a control area and the request list appears here.
          </p>
          <p className="mt-3 text-[12.5px] italic text-ink-4">No control area selected yet.</p>
        </>
      ) : (
        <>
          <p className="mb-3 mt-1 text-[12.5px] leading-normal text-on-surface-3">
            Gather what you can. Anything missing becomes a finding in the pre-read, not a
            surprise in the room.
          </p>
          <div className="space-y-2.5">
            {sections.map((section) => (
              <EvidenceSection key={section.title} title={section.title} items={section.items} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
