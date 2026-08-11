"use client"

import { useEffect, useRef } from "react"

const LINGER_MS = 800

// Marks a scroll container with data-scrolling while it is actively
// scrolling (cleared shortly after it stops); the scrollbar-subtle utility
// shows its thumb only during that window. Writes the attribute directly —
// scroll fires far too often to route through React state.
export const useAutoHideScrollbar = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let timer: number | undefined
    const handleScroll = () => {
      element.dataset.scrolling = "true"
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        delete element.dataset.scrolling
      }, LINGER_MS)
    }
    element.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      element.removeEventListener("scroll", handleScroll)
      window.clearTimeout(timer)
    }
  }, [])

  return ref
}
