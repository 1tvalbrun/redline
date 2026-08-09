"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import type { Claim, Gap } from "@/lib/audit"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { cn } from "@/lib/utils"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const KIND_LABELS: Record<Gap["kind"], string> = {
  absent: "Not found in any material",
  unsupported: "Stated without backing",
}

const ClaimCard = ({ claim }: { claim: Claim }) => (
  <li className="flex flex-col justify-between border border-line-2 bg-surface-raised p-3.5">
    <p className="text-[13.5px] font-semibold leading-[1.45]">
      <span aria-hidden="true" className="mr-1.5 font-mono text-ok">✓</span>
      <span className="sr-only">Cited claim: </span>
      {claim.text}
    </p>
    <p className="mt-2.5 border-t border-line pt-2 font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-3">
      {claim.citation.source} · {claim.citation.location}
    </p>
  </li>
)

const GapCard = ({ gap }: { gap: Gap }) => (
  <li
    className={cn(
      "border border-line-2 bg-surface-raised p-4",
      gap.severity === "blocker" && "border-l-2 border-l-red"
    )}
  >
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-[1px] flex-none px-[7px] py-[3px] font-mono text-[8.5px] uppercase tracking-[.1em]",
          gap.severity === "blocker"
            ? "bg-red text-white"
            : "border border-amber-fg text-amber-fg"
        )}
      >
        {gap.severity}
      </span>
      <p className="text-[14px] font-semibold leading-[1.4]">{gap.title}</p>
    </div>
    <p className="mt-2 text-[12.5px] leading-[1.5] text-on-surface-2">{gap.detail}</p>
    <p className="mt-2 font-mono text-[9px] uppercase tracking-[.08em] text-on-surface-3">
      {KIND_LABELS[gap.kind]}
    </p>
  </li>
)

type AuditStageProps = {
  simulationId: string
}

export const AuditStage = ({ simulationId }: AuditStageProps) => {
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const runAudit = useAction(api.practices.runAudit)
  const [startFailed, setStartFailed] = useState(false)
  const autoStartedRef = useRef(false)

  const handleRunAudit = (force?: boolean) => {
    setStartFailed(false)
    runAudit({ id: typedId, force }).catch(() => setStartFailed(true))
  }

  // Auto-start on first entry: the user just asked for the read, so the
  // audit shouldn't sit behind a button. The ref stops re-render double-fires;
  // the server's idempotent start collapses refreshes and concurrent triggers.
  useEffect(() => {
    if (!practice || practice.audit || autoStartedRef.current) return
    autoStartedRef.current = true
    runAudit({ id: typedId }).catch(() => setStartFailed(true))
  }, [practice, runAudit, typedId])

  if (practice === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const copy = pack.copy.audit
  if (!practice.context) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        Your brief hasn&apos;t been read yet.{" "}
        <Link
          href={`/simulation/${simulationId}/analyze`}
          className="focus-ring underline hover:text-accent-blue"
        >
          Back to the read
        </Link>
        .
      </p>
    )
  }

  const audit = practice.audit
  if (!audit || audit.status === "failed" || audit.status === "running") {
    const failed = audit?.status === "failed" || startFailed
    return (
      <div>
        {failed ? (
          <>
            <StageKicker>{copy.kicker}</StageKicker>
            <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
              The audit hit a wall.
            </h1>
            <p role="alert" className="mt-3.5 max-w-[52ch] text-[13.5px] text-red-fg">
              {audit?.status === "failed"
                ? (audit.failureReason ?? "Something went wrong.")
                : "Couldn't start the audit. Check your connection and try again."}
            </p>
            <div className="mt-6">
              <button type="button" onClick={() => handleRunAudit()} className={FLOW_BTN}>
                Retry the audit <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <WaitingScreen
            kicker={pack.copy.auditWait.kicker}
            heading={pack.copy.auditWait.heading(scopeText(practice.scope, pack.subjectField))}
            lead={pack.copy.auditWait.lead}
            rows={pack.copy.auditWait.rows}
            work={pack.copy.auditWait.work}
            ticker={pack.copy.auditWait.ticker}
            stepMs={pack.copy.auditWait.stepMs}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <StageKicker>{copy.kicker}</StageKicker>
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        {copy.readyHeading}
      </h1>
      <p className="mb-7 mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
        {copy.readyLead}
      </p>

      <section aria-label="Claims extracted" className="mb-8">
        <h2 className="mb-3 flex justify-between font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
          <span>Claims extracted</span>
          <span className="text-on-surface-3">{audit.claims.length} cited</span>
        </h2>
        {audit.claims.length === 0 ? (
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-line-2 bg-surface-raised px-5 py-4">
            <span className="font-display text-[22px] font-extrabold tracking-[-.01em] text-red-fg">
              0 claims cited
            </span>
            <span className="text-[13.5px] text-on-surface-2">
              {copy.zeroClaims}
            </span>
          </p>
        ) : (
          <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-3">
            {audit.claims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} />
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
          <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-2">
            {[...audit.gaps]
              .sort(
                (a, b) =>
                  (a.severity === "blocker" ? 0 : 1) - (b.severity === "blocker" ? 0 : 1)
              )
              .map((gap, i) => (
                <GapCard key={i} gap={gap} />
              ))}
          </ul>
        )}
      </section>

      <div className="mt-[26px] flex items-center gap-3.5">
        <Link href={`/simulation/${simulationId}/panel`} className={FLOW_BTN}>
          {copy.cta} <span aria-hidden="true">→</span>
        </Link>
        <button
          type="button"
          onClick={() => handleRunAudit(true)}
          className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-accent-blue"
        >
          Re-run the audit
        </button>
      </div>
    </div>
  )
}
