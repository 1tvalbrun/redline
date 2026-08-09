"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Clock,
  FileText,
  Folder,
  HelpCircle,
  LayoutGrid,
  Plus,
  Settings,
  SquareStack,
  Users,
} from "lucide-react"
import { useQuery } from "convex/react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import type { FunctionReturnType } from "convex/server"
import { api } from "@convex/_generated/api"
import { getPack, isPackId } from "@/domains/registry"

// Derived from the server function, not re-declared — the rail can't drift
// from what ideas.counts actually returns.
export type NavCounts = FunctionReturnType<typeof api.ideas.counts>

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  tag?: string
}

const NavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex items-center gap-2.5 rounded-[9px] border px-2.5 py-[7px] text-[13.5px] transition-colors",
          active
            ? "border-line bg-surface-raised font-medium text-on-surface shadow-btn"
            : "border-transparent text-on-surface-2 hover:bg-surface-2"
        )}
      >
        <Icon className="h-4 w-4 flex-none text-on-surface-3" />
        {item.label}
        {item.count !== undefined && (
          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-surface-3 px-1.5 text-[11px] font-medium tabular-nums text-on-surface-3">
            {item.count}
          </span>
        )}
        {item.tag && (
          <span className="ml-auto rounded-full border border-line-2 px-[7px] py-px font-mono text-[8.5px] uppercase tracking-[.08em] text-on-surface-3">
            {item.tag}
          </span>
        )}
      </Link>
    </li>
  )
}

const NavGroup = ({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) => (
  <div className="mb-4">
    <p className="px-2.5 pb-[5px] text-[10.5px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
      {label}
    </p>
    <ul>
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
        />
      ))}
    </ul>
  </div>
)

export const AppRail = ({ counts }: { counts: NavCounts | undefined }) => {
  const pathname = usePathname()
  const router = useRouter()
  const user = useQuery(api.users.getCurrent)
  const displayName = user?.displayName ?? "You"
  const laneLabels = (user?.lanes ?? [])
    .filter(isPackId)
    .map((lane) => getPack(lane).label)
    .join(" · ")

  // "N" starts a new run from anywhere in the workspace.
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

  const workspace: NavItem[] = [
    { href: "/", label: "Overview", icon: LayoutGrid },
    { href: "/ideas", label: "Ideas", icon: SquareStack, count: counts?.ideas },
    { href: "/sessions", label: "Sessions", icon: Clock, count: counts?.sessions },
    { href: "/reports", label: "Verdicts", icon: FileText, count: counts?.verdicts },
  ]
  const prep: NavItem[] = [
    { href: "/panel", label: "The Panel", icon: Users },
    { href: "/materials", label: "Materials", icon: Folder },
  ]
  const foot: NavItem[] = [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help & docs", icon: HelpCircle },
  ]

  return (
    <aside className="flex w-[264px] flex-none flex-col border-r border-line bg-surface-rail px-3.5 pb-3.5 pt-5">
      <Link href="/" className="focus-ring flex items-center gap-2.5 px-2.5 pb-5 pt-0.5">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 flex-none place-items-center rounded-[7px] bg-on-surface"
        >
          <span className="block h-[3px] w-3 rounded-[2px] bg-red" />
        </span>
        <span className="text-[15px] font-semibold tracking-[-.01em]">Redline</span>
      </Link>

      <Link
        href="/simulation/new"
        className="focus-ring mb-6 flex items-center gap-2 rounded-[10px] border border-line-2 bg-surface-raised px-3 py-[9px] text-[13.5px] font-medium shadow-btn transition-colors hover:bg-surface-2"
      >
        <Plus className="h-[15px] w-[15px]" />
        New run
        <kbd className="ml-auto rounded-[5px] border border-line-2 bg-surface px-1.5 py-px font-mono text-[10.5px] text-on-surface-3">
          N
        </kbd>
      </Link>

      <nav aria-label="Workspace" className="flex-1 overflow-y-auto">
        <NavGroup label="Workspace" items={workspace} pathname={pathname} />
        <NavGroup label="Prep" items={prep} pathname={pathname} />
      </nav>

      <div className="mt-1.5 border-t border-line pt-3">
        <ul>
          {foot.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </ul>
        <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-[9px]">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-on-surface-2"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 text-[12.5px] font-medium leading-tight text-on-surface-2">
            {displayName}
            <span className="block font-mono text-[9.5px] tracking-[.05em] text-on-surface-3">
              {laneLabels || "Invited testing"}
            </span>
          </span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
