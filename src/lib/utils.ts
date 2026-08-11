import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatElapsed = (fromMs: number, toMs: number) => {
  const seconds = Math.max(0, Math.floor((toMs - fromMs) / 1000))
  const m = String(Math.floor(seconds / 60)).padStart(2, "0")
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

export const relativeDay = (at: number | null): string => {
  if (at === null) return ""
  const days = Math.floor((Date.now() - at) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
