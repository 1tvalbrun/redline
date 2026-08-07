import { cn } from "@/lib/utils"
import { findVerdict } from "@/domains/registry"
import type { VerdictTone } from "@/domains/types"

const TONE_STYLES: Record<VerdictTone, string> = {
  good: "border-ok text-ok",
  mid: "border-amber-fg text-amber-fg",
  bad: "border-red text-red-fg",
}

export const VerdictBadge = ({ decision, className }: { decision: string; className?: string }) => {
  const option = findVerdict(decision)
  return (
    <span
      className={cn(
        "inline-block border px-[7px] py-[2px] font-mono text-[9px] uppercase tracking-[.08em]",
        option ? TONE_STYLES[option.tone] : "border-line-2 text-on-surface-2",
        className
      )}
    >
      {option?.label ?? decision}
    </span>
  )
}
