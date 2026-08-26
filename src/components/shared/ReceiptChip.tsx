import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Real-world filenames overflow the "reads:" rows and make the chips ragged.
// The label is visually capped so chips stay near-uniform; past this length
// the full name is still reachable via tooltip. Display-only — the stored
// material name is never cut.
const TOOLTIP_MIN_CHARS = 28

const CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-2 bg-surface-raised px-3 py-1 text-xs text-on-surface-2"

export const ReceiptChip = ({ label, className }: { label: string; className?: string }) => {
  const body = (
    <>
      <FileText className="size-[11px] flex-none text-on-surface-3" />
      <span className="max-w-[240px] truncate">{label}</span>
    </>
  )
  if (label.length <= TOOLTIP_MIN_CHARS) {
    return <span className={cn(CHIP, className)}>{body}</span>
  }
  return (
    <Tooltip>
      {/* Focusable so keyboard users can open the tooltip and read the
          clipped part of the name — hover-only would leave them without it. */}
      <TooltipTrigger render={<span tabIndex={0} className={cn(CHIP, "focus-ring", className)} />}>
        {body}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
