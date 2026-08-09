"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { UserButton } from "@clerk/nextjs"
import { api } from "@convex/_generated/api"
import { AppRail } from "@/components/layout/AppRail"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"

const CRUMBS: Record<string, string> = {
  ideas: "Ideas",
  sessions: "Sessions",
  reports: "Verdicts",
  panel: "The Panel",
  materials: "Materials",
  benchmarks: "Benchmarks",
  settings: "Settings",
  help: "Help & docs",
}

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const counts = useQuery(api.ideas.counts)
  const clerkAppearance = useClerkAppearance()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus()
  }, [pathname])

  const crumb = CRUMBS[pathname.split("/")[1]] ?? "Overview"

  return (
    <div className="flex h-dvh bg-surface">
      <AppRail counts={counts} />
      <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
        <div className="sticky top-0 z-20 flex items-center gap-5 border-b border-line bg-surface/80 px-10 py-3 backdrop-blur-lg">
          <p className="text-[13px] font-medium text-on-surface">{crumb}</p>
          <div className="ml-auto flex gap-5 font-mono text-[11px] text-on-surface-3">
            <span>
              Ideas{" "}
              <b className="font-medium text-on-surface-2 tabular-nums">{counts?.ideas ?? "—"}</b>
            </span>
            <span>
              Sessions{" "}
              <b className="font-medium text-on-surface-2 tabular-nums">{counts?.sessions ?? "—"}</b>
            </span>
          </div>
          <UserButton appearance={clerkAppearance} />
        </div>
        <div className="mx-auto max-w-[1240px] px-10 pb-20 pt-7">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout
