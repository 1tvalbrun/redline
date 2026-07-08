"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { IdeaList } from "@/components/workspace/IdeaList"
import { WORKSPACE_CTA } from "@/components/workspace/cta"

const IdeasPage = () => {
  const ideas = useQuery(api.ideas.listWithStats)

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">Ideas</h1>
        <Link href="/simulation/new" className={WORKSPACE_CTA}>
          New stress test
        </Link>
      </div>

      {ideas === undefined ? (
        <div className="space-y-3">
          <div className="h-14 animate-pulse bg-surface-2" />
          <div className="h-14 animate-pulse bg-surface-2" />
          <div className="h-14 animate-pulse bg-surface-2" />
        </div>
      ) : ideas.length === 0 ? (
        <p className="text-[13.5px] text-on-surface-2">
          No ideas yet.{" "}
          <Link href="/simulation/new" className="focus-ring underline hover:text-red-fg">
            Start your first stress test
          </Link>
          .
        </p>
      ) : (
        <IdeaList ideas={ideas} />
      )}
    </div>
  )
}

export default IdeasPage
