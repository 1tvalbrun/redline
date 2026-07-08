"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { CONTEXT_FIELDS } from "@/types/simulation"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"

type AuditStageProps = {
  simulationId: string
}

export const AuditStage = ({ simulationId }: AuditStageProps) => {
  const simulation = useQuery(api.simulations.get, {
    id: simulationId as Id<"simulations">,
  })

  if (simulation === undefined) return null
  const context = simulation?.context
  if (simulation === null || !context) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        Your brief hasn&apos;t been read yet.{" "}
        <Link
          href={`/simulation/${simulationId}/analyze`}
          className="focus-ring underline hover:text-red-fg"
        >
          Back to the read
        </Link>
        .
      </p>
    )
  }

  return (
    <div>
      <StageKicker>The audit · before the panel pushes</StageKicker>
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        Here&apos;s what we found.
      </h1>
      <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
        Our read of {simulation.brief.ideaName}, straight from your brief — before a
        single question. The full audit — claims, citations, and the gap map — arrives
        with materials ingest.
      </p>

      <div className="mt-[26px] grid gap-[26px] max-md:grid-cols-1 md:grid-cols-2">
        <section aria-label="What we read">
          <h2 className="mb-3 flex justify-between font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
            <span>What we read</span>
            <span className="text-on-surface-3">{CONTEXT_FIELDS.length} extracted</span>
          </h2>
          <div>
            {CONTEXT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex gap-[11px] border-t border-line py-3 first:border-t-0"
              >
                <span aria-hidden="true" className="flex-none font-mono text-ok">
                  ✓
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold">{field.label}</p>
                  <p className="mt-[2px] text-[12.5px] leading-[1.5] text-on-surface-2">
                    {context[field.key]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="The gap map">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
            The gap map
          </h2>
          <div className="border border-dashed border-line-2 bg-surface-raised p-5">
            <p className="text-[13.5px] font-semibold">Arrives with materials ingest</p>
            <p className="mt-[2px] text-[12.5px] leading-[1.5] text-on-surface-2">
              Once you can drop a deck and your numbers into the brief, this column
              shows what a real diligencer would flag as missing — with citations. The
              panel will press on those first.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-[26px]">
        <Link href={`/simulation/${simulationId}/panel`} className={FLOW_BTN}>
          Take it to the panel <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
