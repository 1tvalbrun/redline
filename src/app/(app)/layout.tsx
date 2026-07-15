"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { INVESTOR_READY_LINE } from "@/lib/readiness"
import { AppRail } from "@/components/layout/AppRail"

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
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus()
  }, [pathname])

  const crumb = CRUMBS[pathname.split("/")[1]] ?? "Overview"

  return (
    <div className="flex h-dvh bg-surface">
      <AppRail counts={counts} />
      <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
        <div className="sticky top-0 z-20 flex items-center gap-5 border-b border-line bg-surface/85 px-10 py-3 backdrop-blur-lg">
          <p className="font-mono text-[11px] uppercase tracking-[.14em] text-on-surface-2">
            <b className="font-semibold text-on-surface">{crumb}</b>
          </p>
          <div className="ml-auto flex gap-5 font-mono text-[10px] uppercase tracking-[.1em] text-on-surface-3">
            <span>
              Ideas <b className="font-semibold text-on-surface tabular-nums">{counts?.ideas ?? "—"}</b>
            </span>
            <span>
              Best <b className="font-semibold text-on-surface tabular-nums">{counts?.best ?? "—"}</b>
            </span>
            <span>
              Ready line <b className="font-semibold text-red-fg tabular-nums">{INVESTOR_READY_LINE}</b>
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] px-10 pb-20 pt-7">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout
