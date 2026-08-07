"use client"

import { useEffect, useState } from "react"
import { READY_LINE } from "@/lib/readiness"
import { cn } from "@/lib/utils"

const START_DEG = 155
const SWEEP_DEG = 230
const TICK_COUNT = 40
const READY_FRACTION = READY_LINE / 100

const CX = 100
const CY = 120
const RADIUS = 82

const polar = (t: number, r: number): [number, number] => {
  const angle = ((START_DEG + t * SWEEP_DEG) * Math.PI) / 180
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

type ReadinessGaugeProps = {
  /** 0-100 readiness score; null renders the pending state */
  value: number | null
  /** What the pack calls the bar (e.g. "Investor-ready"); neutral default for cross-lane surfaces. */
  targetLabel?: string
  className?: string
}

export const ReadinessGauge = ({ value, targetLabel = "Ready", className }: ReadinessGaugeProps) => {
  // Mount flag flipped after the first painted frame so the needle
  // transitions from rest to the value (CSS transitions need a starting
  // frame to animate from).
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const pending = value === null
  const target = pending || !settled ? 0 : Math.max(0, Math.min(100, value)) / 100
  const needleAngle = START_DEG + target * SWEEP_DEG
  const [nx, ny] = polar(0, RADIUS - 13)

  return (
    <svg
      viewBox="0 0 200 140"
      role="img"
      aria-label={
        pending
          ? "Readiness pending, no score yet"
          : `Readiness ${value} of 100; ${targetLabel.toLowerCase()} at ${READY_LINE}`
      }
      className={cn("block", className)}
    >
      {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
        const t = i / TICK_COUNT
        const major = i % 5 === 0
        const [x1, y1] = polar(t, RADIUS)
        const [x2, y2] = polar(t, major ? RADIUS - 10 : RADIUS - 6)
        const stroke =
          t >= READY_FRACTION
            ? "var(--red)"
            : major
              ? "var(--on-surface)"
              : "rgba(24,22,15,.32)"
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={stroke}
            strokeWidth={major ? 1.7 : 1}
            strokeLinecap="round"
          />
        )
      })}
      <line
        x1={CX}
        y1={CY}
        x2={nx}
        y2={ny}
        stroke={pending ? "var(--on-surface-3)" : "var(--on-surface)"}
        strokeWidth={2.6}
        strokeLinecap="round"
        transform={`rotate(${needleAngle - START_DEG} ${CX} ${CY})`}
        className="transition-transform duration-[1200ms] ease-brand motion-reduce:transition-none"
      />
      <circle cx={CX} cy={CY} r={4.5} fill={pending ? "var(--on-surface-3)" : "var(--on-surface)"} />
      <text
        x={CX}
        y={CY + 9}
        textAnchor="middle"
        fill="var(--red)"
        className="font-mono text-[7px] tracking-[1.4px]"
      >
        {targetLabel.toUpperCase()} {READY_LINE}
      </text>
    </svg>
  )
}

/** Count-up display value for score numbers, honoring reduced motion. */
export const useCountUp = (value: number | null, durationMs = 1100) => {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (value === null) return
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
    let frame: number
    let start: number | null = null
    const step = (ts: number) => {
      if (reduceMotion) {
        setDisplayed(value)
        return
      }
      if (start === null) start = ts
      const progress = Math.min((ts - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return value === null ? null : displayed
}
