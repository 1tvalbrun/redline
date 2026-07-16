"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { DEFAULT_CHARACTERS } from "@/components/simulation/characters"

// Measured: the film takes ~4-6 minutes end to end (talking-head
// performance ~35s + act_two room cut ~4 min + storage copy). Past 1.5×
// the copy admits the wait is unusual instead of pretending otherwise.
const EXPECTED_RENDER_SECONDS = 300

// Mirrors the reports.verdictVideo schema object — the stored state of the
// one paid-for film per report.
export type VerdictVideo = {
  status: "pending" | "ready" | "failed"
  url?: string
  speakerId: string
  speakerName: string
  script: string
  // Legacy two-stage shape (no longer written): those docs hold the film
  // here, and a talking-head clip in url that must never render.
  roomVideo?: {
    status: "pending" | "ready" | "failed"
    url?: string
  }
}

type VerdictStageProps = {
  // undefined while the report loads; null when the report has no film
  // (legacy report, or the speaker has no Runway avatar/room scene) — the
  // composed still panel IS the fallback, never an empty hero.
  video: VerdictVideo | null | undefined
  // When generation started (report creation) — drives the honest elapsed
  // readout on the hold.
  pendingSince?: number
  ideaName: string
  verdictLabel: string | null
  className?: string
}

// Plays the film the moment it first arrives: with sound when the browser
// allows (the founder just clicked "End session", so activation is usually
// live), muted with an unmute affordance when it doesn't. Fires once per
// visit. Skipped entirely under prefers-reduced-motion — the native
// controls remain.
const useAutoplay = (activeUrl: string | null) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playedRef = useRef(false)
  const [needsUnmute, setNeedsUnmute] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!activeUrl || !el || playedRef.current) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    playedRef.current = true
    let cancelled = false
    el.play().catch(() => {
      if (cancelled) return
      el.muted = true
      el.play()
        .then(() => {
          if (!cancelled) setNeedsUnmute(true)
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
      el.pause()
    }
  }, [activeUrl])

  const handleUnmute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = false
    void el.play().catch(() => {})
    setNeedsUnmute(false)
  }

  return { videoRef, needsUnmute, handleUnmute }
}

// 1s tick while the hold is visible, so the elapsed readout moves and the
// wait never reads as frozen.
const useElapsedSeconds = (since: number | undefined, active: boolean) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return since === undefined ? null : Math.max(0, Math.round((now - since) / 1000))
}

// The verdict film: the three panelists in the room in one shot, the delivering
// panelist speaking the lip-synced one-line verdict, the other two present
// but silent. Until the film lands (or when there is none), the stage holds
// the composed still panel with the speaker's seat lit; the intermediate
// talking-head clip is never shown.
export const VerdictStage = ({
  video,
  pendingSince,
  ideaName,
  verdictLabel,
  className,
}: VerdictStageProps) => {
  const speakerId = video?.speakerId ?? null
  // Legacy two-stage docs keep the film in roomVideo (their url is a
  // talking-head clip that must never render); current docs keep it in url.
  const film = video?.roomVideo ?? video
  const filmUrl = film?.status === "ready" ? film.url ?? null : null
  // While the report itself is still being written, no film is promised yet —
  // the copy must not claim one, or that the verdict below is complete.
  const reportPending = video === undefined
  const isDeliberating = reportPending || (!filmUrl && film?.status === "pending")
  const filmFailed = !filmUrl && film?.status === "failed"
  const { videoRef, needsUnmute, handleUnmute } = useAutoplay(filmUrl)
  const elapsed = useElapsedSeconds(pendingSince, isDeliberating)
  const overdue = elapsed !== null && elapsed > EXPECTED_RENDER_SECONDS * 1.5

  return (
    <section
      data-surface="dark"
      aria-label="The panel's spoken verdict"
      className={cn(
        "relative overflow-hidden border border-on-surface bg-[#100e0a] text-white",
        className
      )}
    >
      {filmUrl && video ? (
        <div className="relative max-md:aspect-video md:aspect-[21/9]">
          <video
            ref={videoRef}
            src={filmUrl}
            controls
            playsInline
            preload="auto"
            aria-label={`${video.speakerName} speaks the verdict: ${video.script}`}
            className="h-full w-full object-cover"
          />
          {needsUnmute && (
            <button
              type="button"
              onClick={handleUnmute}
              className="focus-ring absolute right-3 top-12 border border-white/40 bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-white transition-colors hover:bg-black/80"
            >
              🔇 Tap for sound
            </button>
          )}
        </div>
      ) : (
        <div className="relative grid grid-cols-3 max-md:aspect-video md:aspect-[21/9]">
          {DEFAULT_CHARACTERS.map((char) => {
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
          {isDeliberating && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(16,14,10,.55)] px-6 text-center">
              <p className="max-w-[38ch] font-display text-[clamp(15px,1.8vw,21px)] font-semibold leading-[1.3] tracking-[-.01em]">
                The panel is deliberating.
                {!reportPending && " Your film will appear here."}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute left-[18px] top-4 font-mono text-[10px] uppercase tracking-[.16em] text-white/70">
        Your verdict{filmUrl ? " · rendered" : ""}
      </div>
      {verdictLabel && (
        <div className="pointer-events-none absolute right-[18px] top-4 border border-white/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.14em] text-white/80">
          {ideaName} · {verdictLabel}
        </div>
      )}

      <div className="border-t border-white/10 px-[22px] py-4">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-red-fg">
          The panel&apos;s verdict
          {video && (
            <span className="normal-case tracking-[.08em] text-white/60">
              · delivered by {video.speakerName}
            </span>
          )}
        </p>
        {isDeliberating ? (
          <div className="mt-2" role="status">
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-white/70">
              <span aria-hidden="true" className="motion-safe:animate-pulse">
                ●
              </span>{" "}
              {reportPending
                ? "Writing the panel's verdict"
                : "Filming the panel's verdict — a few minutes"}
              {elapsed !== null && (
                <span className="tabular-nums text-white/50"> · {elapsed}s</span>
              )}
            </p>
            {!reportPending && (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[.1em] text-white/40">
                {overdue
                  ? "Taking longer than usual — the written verdict below has everything meanwhile"
                  : "The written verdict below is already complete — the film lands here when it's ready"}
              </p>
            )}
          </div>
        ) : video === null || video === undefined ? (
          <p className="mt-2 text-[13.5px] text-white/60">
            The panel&apos;s full written verdict is below.
          </p>
        ) : (
          <p className="mt-2 max-w-[44ch] font-display text-[clamp(17px,2vw,24px)] font-semibold leading-[1.2] tracking-[-.01em]">
            &ldquo;{video.script}&rdquo;
            {filmFailed && (
              <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[.12em] text-white/50">
                The film is unavailable — the verdict stands in full below
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  )
}
