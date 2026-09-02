"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

// next-themes resolves the theme only on the client. Server snapshot is
// false, client snapshot is true, so the first client render after
// hydration swaps the spacer for the real button without an effect.
const emptySubscribe = () => () => {}
const useHydrated = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

export const ThemeToggle = () => {
  const hydrated = useHydrated()
  const { resolvedTheme, setTheme } = useTheme()

  if (!hydrated) return <span className="size-8 max-md:size-10" />

  const isDark = resolvedTheme === "dark"
  const handleToggle = () => setTheme(isDark ? "light" : "dark")

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface-2 focus-ring max-md:size-10"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
