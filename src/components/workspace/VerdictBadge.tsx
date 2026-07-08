import { cn } from "@/lib/utils"

const STYLES: Record<string, string> = {
  advance: "border-ok text-ok",
  iterate: "border-amber-fg text-amber-fg",
  pass: "border-red text-red-fg",
}

export const VerdictBadge = ({ decision, className }: { decision: string; className?: string }) => (
  <span
    className={cn(
      "inline-block border px-[7px] py-[2px] font-mono text-[9px] uppercase tracking-[.08em]",
      STYLES[decision] ?? "border-line-2 text-on-surface-2",
      className
    )}
  >
    {decision}
  </span>
)
