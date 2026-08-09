import { cn } from "@/lib/utils"

const SIZES = {
  sm: "h-6 w-6 text-[9.5px]",
  md: "h-[46px] w-[46px] text-[15px]",
  lg: "h-[52px] w-[52px] text-[17px]",
  xl: "h-16 w-16 text-[20px]",
} as const

export const personaInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

// Neutral initials disc with an optional "available" dot — the stand-in
// until persona photography lands. Deliberately colorless: lanes carry no
// identity color.
export const PersonaAvatar = ({
  name,
  size = "md",
  available,
  className,
}: {
  name: string
  size?: keyof typeof SIZES
  available?: boolean
  className?: string
}) => (
  <span
    aria-label={available ? `${name}, available` : name}
    className={cn(
      "relative grid flex-none place-items-center rounded-full border border-line-2 bg-surface-2 font-semibold text-on-surface-2",
      SIZES[size],
      className
    )}
  >
    {personaInitials(name)}
    {available && (
      <span
        aria-hidden="true"
        className="absolute -right-px bottom-0 h-[11px] w-[11px] rounded-full border-[2.5px] border-surface bg-ok"
      />
    )}
  </span>
)
