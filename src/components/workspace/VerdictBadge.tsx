import { cn } from "@/lib/utils"
import { findVerdict } from "@/domains/registry"

// Verdict words always wear the amber tinted pill, whatever the tone — red
// status pills don't exist in the system (red is reserved for the logo dash
// and the End Session button).
export const VerdictBadge = ({ decision, className }: { decision: string; className?: string }) => {
  const option = findVerdict(decision)
  return (
    <span
      className={cn(
        "inline-block rounded-full border border-warn-line bg-warn-bg px-2.5 py-[2.5px] text-[9.5px] font-semibold uppercase tracking-[.07em] text-warn",
        className
      )}
    >
      {option?.label ?? decision}
    </span>
  )
}
