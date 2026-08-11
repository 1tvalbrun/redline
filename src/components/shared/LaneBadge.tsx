import { cn } from "@/lib/utils"
import { getPack } from "@/domains/registry"

// Lanes are deliberately colorless — identity comes from the label, and a
// new lane never needs a new palette entry.
export const LaneBadge = ({ packId, className }: { packId: string; className?: string }) => (
  <span
    className={cn(
      "inline-block rounded-full border border-line-2 bg-surface-2 px-[9px] py-[2.5px] text-[10px] font-semibold uppercase tracking-[.08em] text-on-surface-2",
      className
    )}
  >
    {getPack(packId).label}
  </span>
)
