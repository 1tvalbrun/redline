"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const STAGES = [
  { key: "brief", label: "Brief" },
  { key: "read", label: "Read" },
  { key: "audit", label: "Audit" },
  { key: "panel", label: "Panel" },
  { key: "room", label: "Room" },
  { key: "verdict", label: "Verdict" },
] as const

export type FlowStage = (typeof STAGES)[number]["key"]

const STAGE_ROUTES: Record<FlowStage, (simulationId: string) => string> = {
  brief: () => "/simulation/new",
  read: (id) => `/simulation/${id}/analyze`,
  audit: (id) => `/simulation/${id}/audit`,
  panel: (id) => `/simulation/${id}/panel`,
  room: (id) => `/simulation/${id}/room`,
  verdict: (id) => `/simulation/${id}/report`,
}

// Mock .btn-primary — shared by every stage CTA.
export const FLOW_BTN =
  "focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent-blue px-[18px] py-2.5 text-[13.5px] font-medium text-primary-foreground shadow-btn transition hover:bg-accent-blue-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"

export const StageKicker = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
    {children}
  </p>
)

type FlowShellProps = {
  stage: FlowStage
  simulationId?: string
  fullBleed?: boolean
  children: React.ReactNode
}

export const FlowShell = ({ stage, simulationId, fullBleed, children }: FlowShellProps) => {
  const mainRef = useRef<HTMLElement>(null)
  const currentIndex = STAGES.findIndex((s) => s.key === stage)

  useEffect(() => {
    mainRef.current?.focus()
  }, [stage])

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex flex-none items-center gap-[26px] border-b border-line bg-surface-rail px-6 py-3.5">
        <Link href="/" className="focus-ring flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-on-surface"
          >
            <span className="block h-[3px] w-[11px] rounded-[2px] bg-red" />
          </span>
          <span className="text-sm font-semibold">Redline</span>
        </Link>

        <nav aria-label="Run progress" className="flex flex-1 justify-center">
          <ol className="flex items-center">
            {STAGES.map((s, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming"
              const href =
                state === "done" && simulationId && s.key !== "brief"
                  ? STAGE_ROUTES[s.key](simulationId)
                  : null
              const step = (
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.04em]",
                    state === "active" && "text-accent-blue",
                    state === "done" && "text-on-surface-3",
                    state === "upcoming" && "text-ink-4"
                  )}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {s.label}
                </span>
              )
              return (
                <li
                  key={s.key}
                  aria-current={state === "active" ? "step" : undefined}
                  className="flex items-center"
                >
                  {href ? (
                    <Link href={href} className="focus-ring">
                      {step}
                    </Link>
                  ) : (
                    step
                  )}
                  {i < STAGES.length - 1 && (
                    <span aria-hidden="true" className="mx-2.5 h-px w-[26px] bg-line-2" />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <Link
          href="/"
          className="focus-ring rounded-lg px-2.5 py-1.5 text-[13px] text-on-surface-3 transition-colors hover:bg-surface-2"
        >
          Save &amp; exit
        </Link>
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      >
        {fullBleed ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-[1080px] px-10 pb-[90px] pt-10">{children}</div>
        )}
      </main>
    </div>
  )
}
