"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

const subscribeToReduceMotion = (onChange: () => void) => {
  const query = matchMedia(REDUCE_MOTION_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const useReduceMotion = () =>
  useSyncExternalStore(
    subscribeToReduceMotion,
    () => matchMedia(REDUCE_MOTION_QUERY).matches,
    () => false
  )

const TICKER_MS = 2100
const TYPE_TICK_MS = 14

type WaitingRow = { label: string; text: string }

type WaitingContent = {
  rows: WaitingRow[]
  work: string[]
  ticker: string[]
  // Row cadence — presentational timing sized to the stage's typical wait,
  // not real backend progress.
  stepMs: number
}

export const READ_WAIT: WaitingContent = {
  rows: [
    { label: "Idea name", text: "Registering what you’re building…" },
    { label: "What it is", text: "Reading the shape of the product…" },
    { label: "Who it’s for", text: "Working out who actually buys this…" },
    { label: "Why now", text: "Looking for what changed to make this urgent…" },
    { label: "Stage", text: "Placing you on the maturity curve…" },
    { label: "Business model", text: "Tracing how the money is meant to work…" },
  ],
  work: [
    "Parsing your brief",
    "Mapping the problem space",
    "Surfacing core assumptions",
    "Naming the primary risk",
    "Drafting the open questions",
  ],
  ticker: [
    "We only work with what you actually gave us.",
    "Nothing gets invented — if we didn’t catch it, we ask.",
    "A gap is a finding, not a failure.",
    "The panel reads this before you walk in.",
  ],
  stepMs: 1250,
}

export const AUDIT_WAIT: WaitingContent = {
  rows: [
    { label: "Claims", text: "Pulling out every claim you’ve made…" },
    { label: "Citations", text: "Tracing each one back to a page…" },
    { label: "Evidence", text: "Checking what’s actually backed…" },
    { label: "Omissions", text: "Finding what a diligencer expects and can’t see…" },
    { label: "Severity", text: "Sorting blockers from gaps…" },
    { label: "Axes", text: "Weighing market, customer, technical, go-to-market…" },
  ],
  work: [
    "Reading your materials",
    "Extracting stated claims",
    "Verifying each against a source",
    "Assembling the gap map",
    "Scoring the four axes",
  ],
  ticker: [
    "Every claim has to trace to a source.",
    "If it can’t be cited, it becomes a gap.",
    "Gaps are what the panel presses on first.",
    "This is the read before a single question.",
  ],
  stepMs: 2000,
}

const TypedText = ({ text }: { text: string }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let shown = 0
    const timer = setInterval(() => {
      shown += 2
      setCount(Math.min(shown, text.length))
      if (shown >= text.length) clearInterval(timer)
    }, TYPE_TICK_MS)
    return () => clearInterval(timer)
  }, [text])

  return (
    <>
      {text.slice(0, count)}
      {count < text.length && (
        <span className="ml-[2px] inline-block h-[1.05em] w-[7px] animate-blink bg-red align-[-2px]" />
      )}
    </>
  )
}

type WaitingScreenProps = WaitingContent & {
  kicker: string
  heading: string
  lead: string
}

// The shared Read/Audit waiting mechanic. Rows carry anticipatory copy about what's
// being examined — never extracted values or counts; the real findings live
// on the next screen. Callers unmount it the moment the real operation
// finishes (never make the founder wait out the animation); if the
// operation runs long it holds on the final row rather than faking
// completion.
export const WaitingScreen = ({ kicker, heading, lead, rows, work, ticker, stepMs }: WaitingScreenProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [tickerIndex, setTickerIndex] = useState(0)
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (reduceMotion) return
    let index = 0
    const timer = setInterval(() => {
      index += 1
      setActiveIndex(Math.min(index, rows.length - 1))
      if (index >= rows.length - 1) clearInterval(timer)
    }, stepMs)
    return () => clearInterval(timer)
  }, [rows.length, stepMs, reduceMotion])

  useEffect(() => {
    if (reduceMotion) return
    const timer = setInterval(() => setTickerIndex((i) => i + 1), TICKER_MS)
    return () => clearInterval(timer)
  }, [reduceMotion])

  const workIndex = Math.min(activeIndex, work.length - 1)
  const progress = reduceMotion ? 100 : Math.round(((activeIndex + 0.5) / rows.length) * 100)
  const activeLabel = rows[activeIndex].label

  return (
    <div>
      <p role="status" className="sr-only">
        {kicker} — examining {activeLabel}
      </p>

      <p className="mb-4 flex items-center gap-[9px] font-mono text-[10.5px] uppercase tracking-[.2em] text-red-fg">
        <span aria-hidden="true" className="h-[7px] w-[7px] animate-pulse-red rounded-full bg-red" />
        {kicker}
      </p>
      <h1 className="max-w-[24ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        {heading}
      </h1>
      <p className="mt-3.5 max-w-[56ch] text-[15.5px] leading-[1.55] text-on-surface-2">{lead}</p>

      <div className="mt-9 grid grid-cols-[1fr_320px] items-start gap-[34px] max-md:grid-cols-1">
        <div aria-hidden="true" className="border-t border-line-2">
          {rows.map((row, i) => {
            const state =
              reduceMotion || i < activeIndex ? "done" : i === activeIndex ? "reading" : "pending"
            return (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-[150px_1fr_22px] items-center gap-[18px] border-b border-line py-[18px] transition-opacity duration-500 ease-brand",
                  state === "pending" && "opacity-30"
                )}
              >
                <div
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[.14em] transition-colors",
                    state === "pending" && "text-on-surface-3",
                    state === "reading" && "text-red-fg",
                    state === "done" && "text-on-surface-2"
                  )}
                >
                  {row.label}
                </div>
                <div
                  className={cn(
                    "min-h-[1.5em] text-[15px]",
                    state === "reading" ? "text-on-surface" : "text-on-surface-2"
                  )}
                >
                  {state === "pending" && (
                    <span className="block h-[9px] w-[62%] animate-shimmer rounded-[2px] bg-[linear-gradient(90deg,var(--line)_0%,rgba(24,22,15,.05)_40%,var(--line)_80%)] bg-[length:200%_100%]" />
                  )}
                  {state === "reading" && <TypedText text={row.text} />}
                  {state === "done" && row.text}
                </div>
                <div
                  className={cn(
                    "text-right font-mono text-[13px] text-ok-fg transition-opacity",
                    state === "done" ? "opacity-100" : "opacity-0"
                  )}
                >
                  ✓
                </div>
              </div>
            )
          })}
        </div>

        <aside
          aria-hidden="true"
          className="sticky top-[88px] border border-line-2 bg-surface-raised p-5 max-md:static"
        >
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[.16em] text-on-surface-2">
            Working
          </p>
          <div className="relative mb-[18px] h-[2px] overflow-hidden bg-line">
            <span
              className="absolute inset-y-0 left-0 bg-red transition-[width] duration-700 ease-brand"
              style={{ width: `${progress}%` }}
            />
          </div>
          {work.map((step, i) => {
            const state =
              reduceMotion || i < workIndex ? "done" : i === workIndex ? "active" : "pending"
            return (
              <div
                key={step}
                className={cn(
                  "flex items-start gap-2.5 py-[9px] font-mono text-[11.5px] leading-[1.45] transition-opacity",
                  state === "pending" && "text-on-surface-3 opacity-40",
                  state === "active" && "text-on-surface",
                  state === "done" && "text-on-surface-2"
                )}
              >
                <span
                  className={cn(
                    "w-3 flex-none",
                    state === "done" && "text-ok-fg",
                    state === "active" && "text-red-fg"
                  )}
                >
                  {state === "done" ? "✓" : state === "active" ? "●" : "○"}
                </span>
                <span>{step}</span>
              </div>
            )
          })}
          <div className="mt-5 min-h-[3.6em] border-t border-line pt-4 text-[12.5px] leading-[1.55] text-on-surface-2">
            <div
              key={tickerIndex}
              className={cn(
                !reduceMotion &&
                  "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-500"
              )}
            >
              {ticker[tickerIndex % ticker.length]}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
