"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import type { Claim, Gap } from "@/lib/audit"
import { deriveAuditRiskScores } from "@/lib/preRunScores"
import { deriveReadiness, AXIS_LABELS, INVESTOR_READY_LINE, AXES } from "@/lib/readiness"
import { cn } from "@/lib/utils"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const KIND_LABELS: Record<Gap["kind"], string> = {
  absent: "Not found in any material",
  unsupported: "Stated without backing",
}

const ClaimRow = ({ claim }: { claim: Claim }) => (
  <li className="flex gap-[11px] border-t border-line py-3 first:border-t-0">
    <span aria-hidden="true" className="flex-none font-mono text-ok">
      ✓
    </span>
    <div>
      <p className="text-[13.5px] font-semibold">
        <span className="sr-only">Cited claim: </span>
        {claim.text}
      </p>
      <p className="mt-[2px] font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-3">
        {claim.citation.source} · {claim.citation.location}
      </p>
    </div>
  </li>
)

const GapRow = ({ gap }: { gap: Gap }) => (
  <li className="flex gap-3 border-t border-line py-3 first:border-t-0">
    <span
      className={cn(
        "mt-[1px] h-fit flex-none px-[7px] py-[3px] font-mono text-[8.5px] uppercase tracking-[.1em]",
        gap.severity === "blocker"
          ? "bg-red text-white"
          : "border border-amber-fg text-amber-fg"
      )}
    >
      {gap.severity}
    </span>
    <div>
      <p className="text-[13.5px] font-semibold">{gap.title}</p>
      <p className="mt-[2px] text-[12.5px] leading-[1.5] text-on-surface-2">{gap.detail}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[.08em] text-on-surface-3">
        {KIND_LABELS[gap.kind]}
        {gap.axis && ` · ${AXIS_LABELS[gap.axis]}`}
      </p>
    </div>
  </li>
)

type AuditStageProps = {
  simulationId: string
}

export const AuditStage = ({ simulationId }: AuditStageProps) => {
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const audit = useQuery(api.audits.getBySimulation, { simulationId: typedId })
  const generateAudit = useAction(api.audits.generate)
  const [startFailed, setStartFailed] = useState(false)

  const handleRunAudit = () => {
    setStartFailed(false)
    generateAudit({ simulationId: typedId }).catch(() => setStartFailed(true))
  }

  if (simulation === undefined || audit === undefined) return null
  if (simulation === null) return <IdeaNotFound />
  if (!simulation.context) {
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

  if (audit === null || audit.status === "failed" || audit.status === "running") {
    return (
      <div>
        <StageKicker>The audit · before the panel pushes</StageKicker>
        {audit?.status === "running" ? (
          <>
            <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
              Auditing {simulation.brief.ideaName}…
            </h1>
            <p aria-live="polite" className="mt-3.5 flex items-center gap-2 text-[15.5px] text-on-surface-2">
              Reading your materials against a diligence framework. This is a live
              model call.
              <span aria-hidden="true" className="inline-block h-[15px] w-[7px] animate-blink bg-red" />
            </p>
          </>
        ) : (
          <>
            <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
              {audit?.status === "failed" ? "The audit hit a wall." : "The audit hasn't run yet."}
            </h1>
            {audit?.status === "failed" && (
              <p role="alert" className="mt-3.5 max-w-[52ch] text-[13.5px] text-red-fg">
                {audit.failureReason ?? "Something went wrong."}
              </p>
            )}
            {startFailed && (
              <p role="alert" className="mt-3.5 text-[13.5px] text-red-fg">
                Couldn&apos;t start the audit. Check your connection and try again.
              </p>
            )}
            <div className="mt-6">
              <button type="button" onClick={handleRunAudit} className={FLOW_BTN}>
                {audit?.status === "failed" ? "Retry the audit" : "Run the audit"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const readiness = deriveReadiness(deriveAuditRiskScores(audit))

  return (
    <div>
      <StageKicker>The audit · before the panel pushes</StageKicker>
      <div className="flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
        <div>
          <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
            Here&apos;s what we found, and what&apos;s missing.
          </h1>
          <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
            Read straight from your materials before a single question. Every gap below
            is something a real diligencer will find. The panel presses on the red ones
            first.
          </p>
        </div>
        <div className="flex-none text-right">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-on-surface-3">
            Pre-run readiness
          </p>
          <p className="mt-1.5 font-display text-[52px] font-extrabold leading-none tracking-[-.03em] tabular-nums">
            {readiness.overall ?? "—"}
            <span className="text-[17px] text-on-surface-3">/100</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[.1em] text-red-fg">
            {readiness.overall === null
              ? "Pending"
              : readiness.overall >= INVESTOR_READY_LINE
                ? "Clear of the investor-ready line"
                : `${INVESTOR_READY_LINE - readiness.overall} below the ready line`}
          </p>
        </div>
      </div>

      <ul className="my-7 grid gap-3.5 max-md:grid-cols-2 md:grid-cols-4" aria-label="Readiness by axis">
        {AXES.map((axis) => {
          const value = readiness.perAxis[axis]
          const weakest = axis === readiness.underFire
          return (
            <li key={axis} className="border border-line-2 bg-surface-raised p-3.5">
              <p className="flex justify-between font-mono text-[10px] uppercase tracking-[.1em] text-on-surface-2">
                {AXIS_LABELS[axis]}
                {weakest && <span className="text-red-fg">weakest</span>}
              </p>
              <p
                className={cn(
                  "my-2 font-display text-[28px] font-extrabold leading-none tracking-[-.02em] tabular-nums",
                  weakest && "text-red-fg"
                )}
              >
                {value ?? "—"}
              </p>
              <div className="relative h-1 overflow-hidden bg-line">
                {value !== null && (
                  <span
                    className={cn("absolute inset-y-0 left-0", weakest ? "bg-red" : "bg-on-surface")}
                    style={{ width: `${value}%` }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-[26px] max-md:grid-cols-1 md:grid-cols-2">
        <section aria-label="Claims extracted">
          <h2 className="mb-3 flex justify-between font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
            <span>Claims extracted</span>
            <span className="text-on-surface-3">{audit.claims.length} cited</span>
          </h2>
          {audit.claims.length === 0 ? (
            <p className="text-[12.5px] leading-[1.5] text-on-surface-2">
              Nothing in your materials could be cited as a concrete claim yet. That&apos;s
              the finding: the panel will treat everything as unproven.
            </p>
          ) : (
            <ul>
              {audit.claims.map((claim, i) => (
                <ClaimRow key={i} claim={claim} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="The gap map">
          <h2 className="mb-3 flex justify-between font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
            <span>The gap map</span>
            <span className="text-on-surface-3">{audit.gaps.length} open</span>
          </h2>
          {audit.gaps.length === 0 ? (
            <p className="text-[12.5px] leading-[1.5] text-on-surface-2">No open gaps found.</p>
          ) : (
            <ul>
              {audit.gaps.map((gap, i) => (
                <GapRow key={i} gap={gap} />
              ))}
            </ul>
          )}
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
