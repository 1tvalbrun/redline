"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack, isPackId, scopeOf } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { BriefForm } from "@/components/simulation/intake/BriefForm"
import { ScopeForm } from "@/components/simulation/intake/ScopeForm"

// Lane resolution: an explicit ?lane= wins, else the user's default lane.
// ?from= prefills the form from a previous run's scope (and pins its lane)
// so adjusting a brief never means retyping it. Lanes with a bespoke intake
// (founder's voice pitch) render it; everything else goes through the
// declarative ScopeForm.
const NewRunPage = ({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; from?: string }>
}) => {
  const { lane, from } = use(searchParams)
  const user = useQuery(api.users.getCurrent)
  const source = useQuery(
    api.simulations.get,
    from ? { id: from as Id<"simulations"> } : "skip"
  )

  if (user === undefined) return null
  // A prefill source that's still loading would flash a blank form; one the
  // caller doesn't own resolves to null and falls through to a blank form.
  if (from && source === undefined) return null

  const requested = lane && isPackId(lane) ? lane : undefined
  const pack = getPack(source?.packId ?? requested ?? user?.defaultLane)
  const lanes = (user?.lanes ?? []).filter(isPackId)
  const initialScope = source ? scopeOf(source) : undefined

  return (
    <FlowShell stage="brief">
      {lanes.length > 1 && !source && (
        <nav
          aria-label="Practice lane"
          className="mx-auto mb-7 flex w-full max-w-[760px] gap-2"
        >
          {lanes.map((laneId) => (
            <Link
              key={laneId}
              href={`/simulation/new?lane=${laneId}`}
              aria-current={laneId === pack.id ? "page" : undefined}
              className={cn(
                "focus-ring border px-[13px] py-2 font-mono text-[11px] uppercase tracking-[.04em] transition-colors",
                laneId === pack.id
                  ? "border-on-surface bg-on-surface text-surface"
                  : "border-line-2 bg-surface-raised text-on-surface-2 hover:text-on-surface"
              )}
            >
              {getPack(laneId).label}
            </Link>
          ))}
        </nav>
      )}
      {pack.prompts.extractBrief ? (
        <BriefForm key={`${pack.id}:${from ?? "new"}`} initialScope={initialScope} />
      ) : (
        <ScopeForm key={`${pack.id}:${from ?? "new"}`} pack={pack} initialScope={initialScope} />
      )}
    </FlowShell>
  )
}

export default NewRunPage
