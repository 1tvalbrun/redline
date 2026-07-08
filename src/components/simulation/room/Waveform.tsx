import { cn } from "@/lib/utils"

// Static class strings so Tailwind can compile the arbitrary delays.
export const SELF_WAVE_DELAYS = [
  "",
  "[animation-delay:.15s]",
  "[animation-delay:.3s]",
  "[animation-delay:.1s]",
]

export const NAMEPLATE_WAVE_DELAYS = [
  "",
  "[animation-delay:.1s]",
  "[animation-delay:.2s]",
  "[animation-delay:.3s]",
  "[animation-delay:.15s]",
  "[animation-delay:.05s]",
]

type WaveformProps = {
  active: boolean
  delays: string[]
  barClassName: string
  className?: string
}

export const Waveform = ({ active, delays, barClassName, className }: WaveformProps) => {
  return (
    <div aria-hidden="true" className={cn("flex items-end", className)}>
      {delays.map((delay, i) => (
        <span
          key={i}
          className={cn(
            "h-[20%]",
            barClassName,
            active ? cn("animate-eq", delay) : "opacity-40"
          )}
        />
      ))}
    </div>
  )
}
