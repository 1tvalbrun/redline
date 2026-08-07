"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { BriefForm } from "@/components/simulation/intake/BriefForm"
import { ScopeForm } from "@/components/simulation/intake/ScopeForm"

// Lane resolution: an explicit ?lane= wins, else the user's default lane.
// Lanes with a bespoke intake (founder's voice pitch) render it; everything
// else goes through the declarative ScopeForm.
const NewRunPage = ({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>
}) => {
  const { lane } = use(searchParams)
  const user = useQuery(api.users.getCurrent)

  if (user === undefined) return null

  const requested = lane && isPackId(lane) ? lane : undefined
  const pack = getPack(requested ?? user?.defaultLane)
  const lanes = (user?.lanes ?? []).filter(isPackId)

  return (
    <FlowShell stage="brief">
      {lanes.length > 1 && (
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
      {pack.prompts.extractBrief ? <BriefForm /> : <ScopeForm pack={pack} />}
    </FlowShell>
  )
}

export default NewRunPage
