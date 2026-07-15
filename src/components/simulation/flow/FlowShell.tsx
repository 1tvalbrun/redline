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

// Mock .btn — shared by every stage CTA.
export const FLOW_BTN =
  "focus-ring inline-flex cursor-pointer items-center gap-[10px] border border-on-surface bg-on-surface px-[26px] py-[15px] font-mono text-[13px] font-medium uppercase tracking-[.04em] text-surface transition-colors hover:border-red hover:bg-red hover:text-white disabled:pointer-events-none disabled:opacity-40"

export const StageKicker = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 flex items-center gap-[9px] font-mono text-[10.5px] uppercase tracking-[.2em] text-red-fg">
    <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-red" />
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
      <header className="flex flex-none items-center gap-[26px] border-b border-line-2 bg-surface px-7 py-3.5">
        <Link href="/" className="focus-ring flex items-center gap-[10px]">
          <span aria-hidden="true" className="relative h-5 w-5 flex-none overflow-hidden rounded-[5px] bg-on-surface">
            <span className="absolute inset-x-0 top-[63%] h-[2px] bg-red" />
          </span>
          <span className="font-display text-[17px] font-extrabold tracking-[-.02em]">Redline</span>
        </Link>

        <nav aria-label="Stress test progress" className="flex flex-1 justify-center">
          <ol className="flex items-center">
            {STAGES.map((s, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming"
              const href =
                state === "done" && simulationId && s.key !== "brief"
                  ? STAGE_ROUTES[s.key](simulationId)
                  : null
              const step = (
                <span className="flex items-center gap-[10px]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-mono text-[10px]",
                      state === "active" ? "text-red-fg" : "text-on-surface-3"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] uppercase tracking-[.14em]",
                      state === "active" && "text-on-surface",
                      state === "done" && "text-on-surface-2",
                      state === "upcoming" && "text-on-surface-3"
                    )}
                  >
                    {s.label}
                  </span>
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
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mx-3.5 h-px w-[34px]",
                        state === "upcoming" ? "bg-line-2" : "bg-on-surface"
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <Link
          href="/"
          className="focus-ring font-mono text-[11px] uppercase tracking-[.1em] text-on-surface-3 transition-colors hover:text-red-fg"
        >
          Save &amp; exit ✕
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
