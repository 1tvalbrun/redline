"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/shared/LogoMark"
import { BTN_SECONDARY } from "@/components/shared/buttons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export type FlowStage = "brief" | "read" | "audit" | "panel" | "room"

const STAGE_ROUTES: Record<FlowStage, (simulationId: string) => string> = {
  brief: () => "/simulation/new",
  read: (id) => `/simulation/${id}/analyze`,
  audit: (id) => `/simulation/${id}/audit`,
  panel: (id) => `/simulation/${id}/panel`,
  room: (id) => `/simulation/${id}/room`,
}

export const StageKicker = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
    {children}
  </p>
)

type FlowShellProps = {
  stage: FlowStage
  simulationId?: string
  // Names the lane before a practice exists — the brief stage's wizard
  // knows the lane, the later stages resolve it from the practice.
  packId?: string
  fullBleed?: boolean
  // The room renders the whole shell on the dark surface.
  dark?: boolean
  // When leaving would interrupt something live, the exit action confirms
  // first; label defaults to the wizard's "Save & exit".
  confirmExit?: { title: string; description: string; label?: string; confirmLabel?: string }
  // Replaces the step rail — the room shows session meta instead of steps.
  centerSlot?: React.ReactNode
  children: React.ReactNode
}

export const FlowShell = ({
  stage,
  simulationId,
  packId,
  fullBleed,
  dark,
  confirmExit,
  centerSlot,
  children,
}: FlowShellProps) => {
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  // The middle beat's name comes from the lane ("Pre-read" for audit lanes,
  // the blueprint label for the interview lane). Resolved from the packId
  // prop when the caller knows it, else from the practice; the default
  // covers the frame before either loads.
  const practice = useQuery(
    api.practices.get,
    packId || !simulationId ? "skip" : { id: simulationId as Id<"practices"> }
  )
  const pack = packId ? getPack(packId) : practice ? getPack(practice.packId) : null
  const displaySteps: { label: string; keys: FlowStage[] }[] = [
    { label: "Brief", keys: ["brief"] },
    { label: pack?.prep.stepLabel ?? "Pre-read", keys: ["read", "audit"] },
    { label: "Panel", keys: ["panel"] },
    { label: "Room", keys: ["room"] },
  ]
  const currentIndex = displaySteps.findIndex((step) => step.keys.includes(stage))

  useEffect(() => {
    mainRef.current?.focus()
  }, [stage])

  const exitClass =
    "focus-ring rounded-lg px-2.5 py-1.5 text-[13px] text-on-surface-3 transition-colors hover:bg-surface-2"

  return (
    <div
      data-surface={dark ? "dark" : undefined}
      className="flex h-dvh flex-col bg-surface text-on-surface"
    >
      <header className="flex flex-none items-center gap-[26px] border-b border-line bg-surface-rail px-6 py-3.5">
        <Link href="/" className="focus-ring flex items-center gap-2">
          <LogoMark size="sm" />
          <span className="text-sm font-semibold">Prestage</span>
        </Link>

        {centerSlot ? (
          <div className="flex flex-1 justify-center">{centerSlot}</div>
        ) : (
        <nav aria-label="Practice progress" className="flex flex-1 justify-center">
          <ol className="flex items-center">
            {displaySteps.map((displayStep, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming"
              const lastKey = displayStep.keys[displayStep.keys.length - 1]
              const href =
                state === "done" && simulationId && lastKey !== "brief"
                  ? STAGE_ROUTES[lastKey](simulationId)
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
                  {displayStep.label}
                </span>
              )
              return (
                <li
                  key={displayStep.label}
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
                  {i < displaySteps.length - 1 && (
                    <span aria-hidden="true" className="mx-2.5 h-px w-[26px] bg-line-2" />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        )}

        {confirmExit ? (
          <AlertDialog>
            {/* A stateful exit earns a real button — plain text is too easy
                to miss as the only door out of the room. */}
            <AlertDialogTrigger className={cn(BTN_SECONDARY, "px-3.5 py-2 text-[13px] hover:text-on-surface")}>
              <LogOut className="size-[14px]" />
              {confirmExit.label ?? "Save & exit"}
            </AlertDialogTrigger>
            <AlertDialogContent size="sm" data-surface={dark ? "dark" : undefined}>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmExit.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmExit.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => router.push("/")}>
                  {confirmExit.confirmLabel ?? confirmExit.label ?? "Save & exit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Link href="/" className={exitClass}>
            Save &amp; exit
          </Link>
        )}
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
