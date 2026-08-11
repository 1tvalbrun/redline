import { cn } from "@/lib/utils"

const SIZES = {
  sm: { box: "h-[22px] w-[22px] rounded-md", bar: "h-[3px] w-[11px]" },
  md: { box: "h-6 w-6 rounded-[7px]", bar: "h-[3px] w-3" },
  lg: { box: "h-8 w-8 rounded-[9px]", bar: "h-1 w-4" },
} as const

export const LogoMark = ({ size = "md" }: { size?: keyof typeof SIZES }) => (
  <span
    aria-hidden="true"
    className={cn("grid flex-none place-items-center bg-on-surface", SIZES[size].box)}
  >
    <span className={cn("block rounded-[2px] bg-red", SIZES[size].bar)} />
  </span>
)
