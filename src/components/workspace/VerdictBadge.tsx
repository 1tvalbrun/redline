import { cn } from "@/lib/utils"
import { findVerdict } from "@/domains/registry"
import type { VerdictTone } from "@/domains/types"

const TONE_STYLES: Record<VerdictTone, string> = {
  good: "border-ok/30 bg-ok-bg text-ok",
  mid: "border-warn-line bg-warn-bg text-warn",
  bad: "border-red-fg/25 bg-red-fg/10 text-red-fg",
}

export const VerdictBadge = ({ decision, className }: { decision: string; className?: string }) => {
  const option = findVerdict(decision)
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-[2.5px] text-[9.5px] font-semibold uppercase tracking-[.07em]",
        option ? TONE_STYLES[option.tone] : "border-line-2 bg-surface-2 text-on-surface-2",
        className
      )}
    >
      {option?.label ?? decision}
    </span>
  )
}
