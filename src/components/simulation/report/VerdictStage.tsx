"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Persona } from "@/domains/types"

// One column per panelist; every shipped pack has 1-3.
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
}

// Mirrors reports.spokenVerdict: the one-line verdict and who delivers it.
export type SpokenVerdict = {
  speakerId: string
  speakerName: string
  text: string
}

type VerdictStageProps = {
  // undefined while the report is still being written — the stage holds the
  // deliberating state over the composed still panel.
  spokenVerdict: SpokenVerdict | undefined
  subject: string
  personas: Persona[]
  verdictLabel: string | null
  className?: string
}

// The verdict tableau: the pack's panel in one composed shot, the
// delivering panelist's seat lit, their one-line verdict quoted beneath.
export const VerdictStage = ({
  spokenVerdict,
  subject,
  personas,
  verdictLabel,
  className,
}: VerdictStageProps) => {
  const speakerId = spokenVerdict?.speakerId ?? null

  return (
    <section
      data-surface="dark"
      aria-label="The verdict"
      className={cn(
        "relative overflow-hidden border border-on-surface bg-[#100e0a] text-white",
        className
      )}
    >
      <div
        className={cn(
          "relative grid max-md:aspect-video md:aspect-[21/9]",
          GRID_COLS[personas.length] ?? "grid-cols-3"
        )}
      >
        {personas.map((char) => {
          const isSpeaker = char.id === speakerId
          return (
            <div key={char.id} className="relative overflow-hidden">
              <Image
                src={char.image}
                alt=""
                fill
                sizes="(max-width: 768px) 33vw, 420px"
                className={cn(
                  "object-cover object-[center_28%]",
                  isSpeaker ? "opacity-100" : "opacity-60 grayscale"
                )}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-[rgba(16,14,10,.75)]"
              />
              {isSpeaker && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_var(--color-red)] opacity-40 motion-safe:animate-pulse"
                />
              )}
              <p
                className={cn(
                  "pointer-events-none absolute bottom-[14px] left-4 font-mono text-[10.5px] uppercase tracking-[.14em]",
                  isSpeaker ? "text-white" : "text-white/60"
                )}
              >
                {isSpeaker && (
                  <span aria-hidden="true" className="text-red-fg">
                    ●{" "}
                  </span>
                )}
                {char.name}
              </p>
            </div>
          )
        })}
        {!spokenVerdict && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(16,14,10,.55)] px-6 text-center">
            <p className="max-w-[38ch] font-display text-[clamp(15px,1.8vw,21px)] font-semibold leading-[1.3] tracking-[-.01em]">
              Still deliberating.
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute left-[18px] top-4 font-mono text-[10px] uppercase tracking-[.16em] text-white/70">
        Your verdict
      </div>
      {verdictLabel && (
        <div className="pointer-events-none absolute right-[18px] top-4 border border-white/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.14em] text-white/80">
          {subject} · {verdictLabel}
        </div>
      )}

      <div className="border-t border-white/10 px-[22px] py-4">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-red-fg">
          The verdict
          {spokenVerdict && (
            <span className="normal-case tracking-[.08em] text-white/60">
              · delivered by {spokenVerdict.speakerName}
            </span>
          )}
        </p>
        {spokenVerdict ? (
          <p className="mt-2 max-w-[44ch] font-display text-[clamp(17px,2vw,24px)] font-semibold leading-[1.2] tracking-[-.01em]">
            &ldquo;{spokenVerdict.text}&rdquo;
          </p>
        ) : (
          <p className="mt-2" role="status">
            <span className="font-mono text-[11px] uppercase tracking-[.14em] text-white/70">
              <span aria-hidden="true" className="motion-safe:animate-pulse">
                ●
              </span>{" "}
              Writing the verdict
            </span>
          </p>
        )}
      </div>
    </section>
  )
}
