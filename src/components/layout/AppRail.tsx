"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, Settings } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { LogoMark } from "@/components/shared/LogoMark"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"

// Derived from the server function, not re-declared — the rail can't drift
// from what practices.list actually returns.
export type PracticeRow = FunctionReturnType<typeof api.practices.list>[number]

const Thread = ({ practice, active }: { practice: PracticeRow; active: boolean }) => (
  <li>
    <Link
      href={`/p/${practice.practiceId}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring flex w-full items-center gap-2 rounded-[9px] border px-2.5 py-[7px] text-[13.5px] transition-colors",
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
  </li>
)

// practices === undefined means the query hasn't resolved — render the lane
// head alone rather than a false "Nothing yet".
const Lane = ({
  packId,
  practices,
  pathname,
}: {
  packId: string
  practices: PracticeRow[] | undefined
  pathname: string
}) => (
  <div className="mb-[18px]">
    <p className="flex items-center gap-[7px] px-2.5 pb-[5px] text-[10.5px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-ink-4" />
      {getPack(packId).label}
    </p>
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
          />
        ))}
      </ul>
    )}
  </div>
)

export const AppRail = () => {
  const pathname = usePathname()
  const router = useRouter()
  const user = useQuery(api.users.getCurrent)
  const practices = useQuery(api.practices.list)
  const clerkAppearance = useClerkAppearance()
  const lanes = (user?.lanes ?? []).filter(isPackId)
  const displayName = user?.displayName ?? "You"

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
        <span className="text-[15px] font-semibold tracking-[-.01em]">Redline</span>
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

      <nav aria-label="Practices" className="flex-1 overflow-y-auto">
        {lanes.map((lane) => (
          <Lane
            key={lane}
            packId={lane}
            practices={practices?.filter((practice) => practice.packId === lane)}
            pathname={pathname}
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
