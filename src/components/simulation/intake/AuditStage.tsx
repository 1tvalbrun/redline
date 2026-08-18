"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import type { Claim, Gap } from "@/lib/audit"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { cn } from "@/lib/utils"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const KIND_LABELS: Record<Gap["kind"], string> = {
  absent: "Not found in any material",
  unsupported: "Stated without backing",
}

const ClaimCard = ({ claim }: { claim: Claim }) => (
  <li className="flex flex-col justify-between rounded-xl border border-line bg-surface-raised p-4 shadow-card">
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

// Uniform cards: severity speaks through the pill tint and sort order,
// never through alarm styling — same construction as the verdict badges
// and priority tags everywhere else.
const SEVERITY_PILL: Record<Gap["severity"], string> = {
  blocker: "border-red-fg/25 bg-red-fg/10 text-red-fg",
  gap: "border-warn-line bg-warn-bg text-warn",
}

const GapCard = ({ gap }: { gap: Gap }) => (
  <li className="rounded-xl border border-line bg-surface-raised p-4 shadow-card">
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex-none rounded-full border px-2 py-[2px] font-mono text-[9px] font-semibold uppercase tracking-[.08em]",
          SEVERITY_PILL[gap.severity]
        )}
      >
        {gap.severity}
      </span>
      <p className="text-[14px] font-semibold leading-[1.4]">{gap.title}</p>
    </div>
    <p className="mt-2 text-[13px] leading-normal text-on-surface-2">{gap.detail}</p>
    <p className="mt-2.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-ink-4">
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

  const handleRunAudit = () => {
    setStartFailed(false)
    runAudit({ id: typedId }).catch(() => setStartFailed(true))
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
  const prep = pack.prep
  if (prep.kind !== "audit") return null
  const copy = prep.copy
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
            <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
              The audit hit a wall.
            </h1>
            <p role="alert" className="mt-3 max-w-[52ch] text-[13.5px] text-red-fg">
              {audit?.status === "failed"
                ? (audit.failureReason ?? "Something went wrong.")
                : "Couldn't start the audit. Check your connection and try again."}
            </p>
            <div className="mt-6">
              <button type="button" onClick={handleRunAudit} className={BTN_PRIMARY}>
                Retry the audit <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <WaitingScreen
            kicker={prep.wait.kicker}
            heading={prep.wait.heading(scopeText(practice.scope, pack.subjectField))}
            lead={prep.wait.lead}
            rows={prep.wait.rows}
            work={prep.wait.work}
            ticker={prep.wait.ticker}
            stepMs={prep.wait.stepMs}
          />
        )}
      </div>
    )
  }

  const blockers = audit.gaps.filter((gap) => gap.severity === "blocker")
  const plainGaps = audit.gaps.length - blockers.length
  const sortedGaps = [...audit.gaps].sort(
    (a, b) => (a.severity === "blocker" ? 0 : 1) - (b.severity === "blocker" ? 0 : 1)
  )

  return (
    <div>
      <StageKicker>{copy.kicker}</StageKicker>
      <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
        {copy.readyHeading}
      </h1>
      <p className="mb-8 mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-on-surface-2">
        {copy.readyLead}
      </p>

      <section aria-label="Claims extracted" className="mb-9">
        {audit.claims.length === 0 ? (
          // The one clay accent on the page: the finding.
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-line border-l-[3px] border-l-red-fg bg-surface-raised px-5 py-4 shadow-card">
            <span className="font-serif text-[19px] font-semibold text-red-fg">
              0 claims cited
            </span>
            <span className="text-[13.5px] leading-relaxed text-on-surface-2">
              {copy.zeroClaims}
            </span>
          </p>
        ) : (
          <>
            <h2 className="mb-3 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
              <span>Claims extracted</span>
              <span className="font-mono text-[10.5px] tracking-[.02em]">
                {audit.claims.length} cited
              </span>
            </h2>
            <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-3">
              {audit.claims.map((claim, i) => (
                <ClaimCard key={i} claim={claim} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="The gap map">
        <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
          <span>The gap map</span>
          {audit.gaps.length > 0 && (
            <span className="font-mono text-[10.5px] normal-case tracking-[.02em]">
              <b className="font-medium text-on-surface-2">
                {blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {plainGaps} gap
                {plainGaps === 1 ? "" : "s"}
              </b>
              {blockers[0] && (
                <span className="text-ink-4"> · weakest: {blockers[0].title.toLowerCase()}</span>
              )}
            </span>
          )}
        </h2>
        {audit.gaps.length === 0 ? (
          <p className="text-[13px] leading-normal text-on-surface-2">No open gaps found.</p>
        ) : (
          <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-2">
            {sortedGaps.map((gap, i) => (
              <GapCard key={i} gap={gap} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3.5">
        <Link href={`/simulation/${simulationId}/panel`} className={BTN_PRIMARY}>
          {copy.cta} <span aria-hidden="true">→</span>
        </Link>
        <Link
          href={`/simulation/new?from=${simulationId}`}
          className={BTN_SECONDARY}
        >
          <RefreshCw className="size-[13px]" />
          Add materials &amp; re-run
        </Link>
        <span className="text-[12.5px] text-on-surface-3">
          Walking in with gaps is fine. That&apos;s what practice is for.
        </span>
      </div>
    </div>
  )
}
