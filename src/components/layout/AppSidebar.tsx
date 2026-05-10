"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Diamond, Plus, List, Circle, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/home", label: "Home", icon: Diamond },
  { href: "/simulation/new", label: "New simulation", icon: Plus },
  { href: "/reports", label: "Reports", icon: List },
  { href: "#", label: "Saved ideas", icon: Circle, soon: true },
  { href: "#", label: "Templates", icon: Square, soon: true },
]

export const AppSidebar = () => {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[228px] flex-col border-r border-border bg-card px-3 py-5">
      <div className="mb-8 flex items-center gap-2 px-3">
        <div className="h-6 w-6 rounded-sm bg-foreground" />
        <span className="font-display text-lg font-semibold tracking-tight">
          Redline
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && item.href !== "#"
          const Icon = item.icon

          if (item.soon) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] font-medium">
                  SOON
                </Badge>
              </div>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
