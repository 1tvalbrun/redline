"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { AppRail } from "@/components/layout/AppRail"

// The shell is just the rail plus a scrollable main — pages own their own
// column (max-width, padding), per the mocks.
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus()
  }, [pathname])

  return (
    <div className="flex h-dvh bg-surface">
      <AppRail />
      <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
