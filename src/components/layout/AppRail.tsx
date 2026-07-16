"use client"

import { useEffect, useState } from "react"
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
import { cn } from "@/lib/utils"

export type NavCounts = {
  ideas: number
  sessions: number
  verdicts: number
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  tag?: string
}

const RailClock = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])
  return (
    <span className="tabular-nums">
      {new Date(now).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
    </span>
  )
}

const NavLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon
  return (
    <li className="relative">
      {active && (
        <span aria-hidden="true" className="absolute -left-3.5 bottom-[7px] top-[7px] w-[2px] bg-red" />
      )}
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex items-center gap-[11px] rounded-[3px] px-2.5 py-2 text-[13.5px] font-medium transition-colors",
          active
            ? "bg-surface text-on-surface"
            : "text-on-surface-2 hover:bg-on-surface/5 hover:text-on-surface"
        )}
      >
        <Icon className="h-4 w-4 flex-none" />
        {item.label}
        {item.count !== undefined && (
          <span className="ml-auto font-mono text-[10px] tabular-nums text-on-surface-3">
            {item.count}
          </span>
        )}
        {item.tag && (
          <span className="ml-auto border border-line-2 px-[5px] py-px font-mono text-[8.5px] uppercase tracking-[.08em] text-on-surface-3">
            {item.tag}
          </span>
        )}
      </Link>
    </li>
  )
}

const NavGroup = ({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) => (
  <div className="mb-3.5">
    <p className="px-2.5 pb-[7px] font-mono text-[9.5px] uppercase tracking-[.2em] text-on-surface-3">
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

  // "N" starts a new stress test from anywhere in the workspace.
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
    <aside className="flex w-[260px] flex-none flex-col border-r border-line-2 bg-surface-rail px-3.5 pb-3 pt-[18px]">
      <Link href="/" className="focus-ring flex items-center gap-[11px] px-2 pb-4 pt-1.5">
        <span aria-hidden="true" className="relative h-[22px] w-[22px] flex-none overflow-hidden rounded-[5px] bg-on-surface">
          <span className="absolute inset-x-0 top-[63%] h-[2px] bg-red" />
        </span>
        <span className="font-display text-lg font-extrabold tracking-[-.02em]">Redline</span>
      </Link>

      <Link
        href="/simulation/new"
        className="focus-ring mb-1.5 flex items-center gap-2.5 bg-on-surface px-[13px] py-3 font-mono text-xs font-medium uppercase tracking-[.04em] text-surface transition-colors hover:bg-red hover:text-white"
      >
        <Plus className="h-[15px] w-[15px]" />
        New stress test
        <kbd className="ml-auto border border-white/20 px-[5px] font-mono text-[10px] text-white/60">N</kbd>
      </Link>

      <nav aria-label="Workspace" className="flex-1 overflow-y-auto pt-2">
        <NavGroup label="Workspace" items={workspace} pathname={pathname} />
        <NavGroup label="Prep" items={prep} pathname={pathname} />
      </nav>

      <div className="mt-1.5 border-t border-line pt-2.5">
        <p className="flex items-center justify-between px-2.5 py-[5px] font-mono text-[10px] uppercase tracking-[.1em] text-on-surface-2">
          <span className="flex items-center gap-[7px]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ok" />
            System ready
          </span>
          <RailClock />
        </p>
        <ul>
          {foot.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </ul>
        <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-[9px]">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-on-surface font-display text-xs font-bold text-surface"
          >
            F
          </span>
          <span className="text-[12.5px] font-medium leading-tight">
            Founder
            <span className="block font-mono text-[9.5px] tracking-[.05em] text-on-surface-3">
              Single-user demo
            </span>
          </span>
        </div>
      </div>
    </aside>
  )
}
