"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, Pin, Plus, Settings } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { LogoMark } from "@/components/shared/LogoMark"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"

// Folded lanes are a view preference, not data — they live in the browser.
// Safe to read in a state initializer: the rail never server-renders (the
// auth gate shows the splash until the client session resolves).
const COLLAPSED_LANES_KEY = "prestage.collapsedLanes"

const readCollapsedLanes = (): ReadonlySet<string> => {
  if (typeof window === "undefined") return new Set()
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(COLLAPSED_LANES_KEY) ?? "[]")
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [])
  } catch {
    return new Set()
  }
}

// Derived from the server function, not re-declared — the rail can't drift
// from what practices.list actually returns.
export type PracticeRow = FunctionReturnType<typeof api.practices.list>[number]

const Thread = ({
  practice,
  active,
  onTogglePin,
}: {
  practice: PracticeRow
  active: boolean
  onTogglePin: () => void
}) => (
  <li className="group/thread flex items-center gap-1">
    <Link
      href={`/p/${practice.practiceId}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border px-2.5 py-[7px] text-[13.5px] transition-colors",
        active
          ? "border-line bg-surface-raised font-medium text-on-surface shadow-btn"
          : "border-transparent text-on-surface-2 hover:bg-surface-2"
      )}
    >
      <span className="flex-1 truncate">{practice.name}</span>
      {practice.openItems > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface-3 px-1.5 text-[11px] font-medium tabular-nums text-on-surface-3">
          {practice.openItems}
        </span>
      )}
    </Link>
    <button
      type="button"
      onClick={onTogglePin}
      aria-label={practice.pinned ? `Unpin ${practice.name}` : `Pin ${practice.name}`}
      aria-pressed={practice.pinned}
      className={cn(
        "focus-ring grid size-6 flex-none place-items-center rounded-md text-ink-4 transition-opacity hover:bg-surface-2 hover:text-on-surface-2 focus-visible:opacity-100",
        practice.pinned ? "text-on-surface-3" : "opacity-0 group-hover/thread:opacity-100"
      )}
    >
      {practice.pinned ? <Pin className="size-3 fill-current" /> : <Pin className="size-3" />}
    </button>
  </li>
)

// practices === undefined means the query hasn't resolved — render the lane
// head alone rather than a false "Nothing yet".
const Lane = ({
  packId,
  practices,
  pathname,
  collapsed,
  onToggle,
  onTogglePin,
}: {
  packId: string
  practices: PracticeRow[] | undefined
  pathname: string
  collapsed: boolean
  onToggle: () => void
  onTogglePin: (practice: PracticeRow) => void
}) => (
  <div className="mb-[18px]">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="focus-ring flex w-full items-center gap-[7px] rounded-md px-2.5 pb-[5px] text-[10.5px] font-semibold uppercase tracking-[.09em] text-on-surface-3 transition-colors hover:text-on-surface-2"
    >
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-ink-4" />
      {getPack(packId).label}
      <ChevronDown
        aria-hidden="true"
        className={cn("ml-auto size-3 transition-transform", collapsed && "-rotate-90")}
      />
    </button>
    {/* 0fr → 1fr grid rows animate height without measuring it; inert keeps
        folded threads out of the tab order and accessibility tree. */}
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
        collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
      )}
    >
      <div className="overflow-hidden" inert={collapsed || undefined}>
        {practices?.length === 0 && (
          <p className="px-2.5 py-1 text-[12.5px] italic text-ink-4">Nothing yet</p>
        )}
        {practices && practices.length > 0 && (
          <ul>
            {practices.map((practice) => (
              <Thread
                key={practice.practiceId}
                practice={practice}
                active={pathname.startsWith(`/p/${practice.practiceId}`)}
                onTogglePin={() => onTogglePin(practice)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  </div>
)

export const AppRail = () => {
  const pathname = usePathname()
  const router = useRouter()
  const user = useQuery(api.users.getCurrent)
  const practices = useQuery(api.practices.list)
  const clerkAppearance = useClerkAppearance()
  const railScroll = useAutoHideScrollbar<HTMLElement>()
  const setPinned = useMutation(api.practices.setPinned)
  const [collapsedLanes, setCollapsedLanes] = useState<ReadonlySet<string>>(readCollapsedLanes)
  const lanes = (user?.lanes ?? []).filter(isPackId)
  const displayName = user?.displayName ?? "You"

  const handleToggleLane = (laneId: string) => {
    const next = new Set(collapsedLanes)
    if (next.has(laneId)) {
      next.delete(laneId)
    } else {
      next.add(laneId)
    }
    window.localStorage.setItem(COLLAPSED_LANES_KEY, JSON.stringify([...next]))
    setCollapsedLanes(next)
  }

  // "N" starts a new practice from anywhere in the workspace.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return
      router.push("/simulation/new")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <aside className="flex w-[264px] flex-none flex-col border-r border-line bg-surface-rail px-3.5 pb-3.5 pt-5">
      <Link href="/" className="focus-ring flex items-center gap-2.5 px-2.5 pb-5 pt-0.5">
        <LogoMark />
        <span className="text-[15px] font-semibold tracking-[-.01em]">Prestage</span>
      </Link>

      <Link
        href="/simulation/new"
        className="focus-ring mb-6 flex items-center gap-2 rounded-[10px] border border-line-2 bg-surface-raised px-3 py-[9px] text-[13.5px] font-medium shadow-btn transition-colors hover:bg-surface-2"
      >
        <Plus className="h-[15px] w-[15px]" />
        New practice
        <kbd className="ml-auto rounded-[5px] border border-line-2 bg-surface px-1.5 py-px font-mono text-[10.5px] text-on-surface-3">
          N
        </kbd>
      </Link>

      <nav ref={railScroll} aria-label="Practices" className="scrollbar-subtle flex-1 overflow-y-auto">
        {lanes.map((lane) => (
          <Lane
            key={lane}
            packId={lane}
            practices={practices?.filter((practice) => practice.packId === lane)}
            pathname={pathname}
            collapsed={collapsedLanes.has(lane)}
            onToggle={() => handleToggleLane(lane)}
            onTogglePin={(practice) =>
              setPinned({ id: practice.practiceId, pinned: !practice.pinned })
            }
          />
        ))}
      </nav>

      <div className="mt-1.5 border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-1.5">
          <UserButton appearance={clerkAppearance} />
          <span className="flex-1 truncate text-[12.5px] font-medium leading-tight text-on-surface-2">
            {displayName}
          </span>
          <ThemeToggle />
          <Link
            href="/settings"
            aria-label="Settings"
            className="focus-ring grid size-8 place-items-center rounded-lg text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface-2"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>
    </aside>
  )
}
