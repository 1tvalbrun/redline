import { cn } from "@/lib/utils"
import { AI_DISCLOSURE } from "@/lib/legal"

// The standing honesty line. Rendered wherever AI output is presented as
// feedback (the room, the debrief), so every lane inherits it.
export const Disclosure = ({ className }: { className?: string }) => (
  <p
    className={cn(
      "font-mono text-[9.5px] uppercase leading-[1.7] tracking-[.08em] text-on-surface-2",
      className
    )}
  >
    {AI_DISCLOSURE}
  </p>
)
