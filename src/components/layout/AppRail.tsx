"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Check, ChevronDown, Pin, Plus, Settings, Trash2 } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { cn, prefersReducedMotion } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { LogoMark } from "@/components/shared/LogoMark"
import { BrandName } from "@/components/shared/BrandName"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"

// Folded lanes are a view preference, not data — they live in the browser.
// Safe to read in a state initializer: the rail never server-renders (the
// auth gate shows the splash until the client session resolves).
const COLLAPSED_LANES_KEY = "prestage.collapsedLanes"

// Must match duration-300 on the thread collapse wrapper, or the row
// unmounts mid-collapse.
const EXIT_MS = 300

const NEW_PRACTICE_LINK_ID = "new-practice-link"

// Focus target once a deleted thread unmounts (taking the dialog's trigger
// with it), so keyboard users aren't dropped back to <body>.
const focusNewPractice = () => document.getElementById(NEW_PRACTICE_LINK_ID)?.focus()

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
  removing,
  onTogglePin,
  onDelete,
}: {
  practice: PracticeRow
  active: boolean
  removing: boolean
  onTogglePin: () => void
  onDelete: () => void
}) => {
  const todos = `${practice.openItems} todo${practice.openItems === 1 ? "" : "s"}`
  return (
  <li
    className={cn(
      "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
      removing ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
    )}
  >
    {/* Clip only while collapsing — overflow-hidden at rest would crop the
        focus rings of the row's controls. */}
    <div className={removing ? "overflow-hidden" : undefined}>
      <div className="group/thread flex items-center gap-1">
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
          {practice.openItems > 0 ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface-3 px-1.5 text-[11px] font-medium tabular-nums text-on-surface-3" />
                }
              >
                <span aria-hidden="true">{practice.openItems}</span>
                <span className="sr-only">{todos}</span>
              </TooltipTrigger>
              <TooltipContent>{todos}</TooltipContent>
            </Tooltip>
          ) : practice.hasActionItems ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface-3 px-1.5 text-on-surface-3" />
                }
              >
                <Check className="size-3" strokeWidth={2.5} />
                <span className="sr-only">Todos done</span>
              </TooltipTrigger>
              <TooltipContent>Todos done</TooltipContent>
            </Tooltip>
          ) : null}
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
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${practice.name}`}
          className="focus-ring grid size-6 flex-none place-items-center rounded-md text-ink-4 opacity-0 transition-opacity hover:bg-surface-2 hover:text-red-fg focus-visible:opacity-100 group-hover/thread:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  </li>
  )
}

// practices === undefined means the query hasn't resolved — render the lane
// head alone rather than a false "Nothing yet".
const Lane = ({
  packId,
  practices,
  pathname,
  collapsed,
  removing,
  onToggle,
  onTogglePin,
  onDelete,
}: {
  packId: string
  practices: PracticeRow[] | undefined
  pathname: string
  collapsed: boolean
  removing: ReadonlySet<string>
  onToggle: () => void
  onTogglePin: (practice: PracticeRow) => void
  onDelete: (practice: PracticeRow) => void
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
        {/* every() is vacuously true on an empty lane, so this covers both
            "already empty" and "last thread mid delete" — the placeholder
            grows in while that thread collapses. */}
        {practices?.every((practice) => removing.has(practice.practiceId)) && (
          <div className="grid grid-rows-[1fr] animate-row-in motion-reduce:animate-none">
            <p className="overflow-hidden px-2.5 py-1 text-[12.5px] italic text-ink-4">
              Nothing yet
            </p>
          </div>
        )}
        {practices && practices.length > 0 && (
          <ul>
            {practices.map((practice) => (
              <Thread
                key={practice.practiceId}
                practice={practice}
                active={pathname.startsWith(`/p/${practice.practiceId}`)}
                removing={removing.has(practice.practiceId)}
                onTogglePin={() => onTogglePin(practice)}
                onDelete={() => onDelete(practice)}
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
  const removePractice = useMutation(api.practices.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.practices.list, {})
      if (!current) return
      localStore.setQuery(
        api.practices.list,
        {},
        current.filter((practice) => practice.practiceId !== args.id)
      )
    }
  )
  const [collapsedLanes, setCollapsedLanes] = useState<ReadonlySet<string>>(readCollapsedLanes)
  // The target outlives the dialog's open state: clearing it on close would
  // blank the title mid exit animation.
  const [confirmTarget, setConfirmTarget] = useState<PracticeRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Threads mid delete animation: collapsing in the rail until the removal
  // lands (the mutation fires when the collapse ends).
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set())
  const [deleteFailed, setDeleteFailed] = useState(false)
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

  const handleRequestDelete = (practice: PracticeRow) => {
    setConfirmTarget(practice)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return
    const { practiceId } = confirmTarget
    setConfirmOpen(false)
    setDeleteFailed(false)
    setRemoving((prev) => new Set(prev).add(practiceId))
    window.setTimeout(
      () => {
        removePractice({ id: practiceId })
          .then(() => {
            if (window.location.pathname.startsWith(`/p/${practiceId}`)) router.push("/")
          })
          .catch(() => setDeleteFailed(true))
          .finally(() =>
            setRemoving((prev) => {
              const next = new Set(prev)
              next.delete(practiceId)
              return next
            })
          )
        focusNewPractice()
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    )
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
        <span className="text-[15px] font-semibold tracking-[-.01em]">
          <BrandName />
        </span>
      </Link>

      <Link
        id={NEW_PRACTICE_LINK_ID}
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
            removing={removing}
            onDelete={handleRequestDelete}
          />
        ))}
      </nav>

      {deleteFailed && (
        <p role="alert" className="px-2.5 py-1.5 text-[12.5px] text-red-fg">
          Deletion didn&apos;t go through, so nothing was removed. Check your connection and try
          again.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the practice with its sessions, transcripts, debriefs,
              and uploads. There&apos;s no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete practice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
