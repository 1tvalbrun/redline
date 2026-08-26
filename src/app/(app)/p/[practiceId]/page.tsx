"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Video } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { cn, relativeDay } from "@/lib/utils"
import { getPack } from "@/domains/registry"
import { firstNameOf } from "@/domains/types"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { LaneBadge } from "@/components/shared/LaneBadge"
import { PersonaAvatar } from "@/components/shared/PersonaAvatar"
import { ToWorkOn } from "@/components/workspace/ToWorkOn"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"

const PracticePage = ({ params }: { params: Promise<{ practiceId: string }> }) => {
  const { practiceId } = use(params)
  const id = practiceId as Id<"practices">
  const router = useRouter()
  const practice = useQuery(api.practices.get, { id })
  const sessions = useQuery(api.sessions.listByPractice, { practiceId: id })
  const materials = useQuery(api.materials.listByPractice, { practiceId: id })
  const continueSession = useMutation(api.practices.continueSession)
  const [expandedGaps, setExpandedGaps] = useState<ReadonlySet<number>>(new Set())
  const [showAllQuestions, setShowAllQuestions] = useState(false)

  const handleToggleGap = (index: number) =>
    setExpandedGaps((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const handleShowAllQuestions = () => setShowAllQuestions((current) => !current)

  if (practice === undefined) return null
  if (practice === null) {
    return (
      <div className="mx-auto max-w-[640px] px-8 pt-24 text-center">
        <p className="text-[15px] text-on-surface-2">This practice doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-accent-blue hover:underline">
          Back home
        </Link>
      </div>
    )
  }

  const pack = getPack(practice.packId)
  const persona = practice.personaId
    ? pack.personas.find((p) => p.id === practice.personaId) ?? null
    : null
  const personaFirst = persona ? firstNameOf(persona.name) : null
  const gaps = practice.audit?.status === "ready" ? practice.audit.gaps : []
  // Only real questions make the rail — the analyze model writes prose like
  // "Not provided in pitch scope." for missing info, which is honest data
  // but not an open question.
  const openQuestions = (practice.context?.openQuestions ?? "")
    .split(/\n|(?<=\?)\s+/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("?"))
  const visibleQuestions = showAllQuestions ? openQuestions : openQuestions.slice(0, 4)

  const handleContinue = async () => {
    try {
      const { sessionId } = await continueSession({ id })
      router.push(sessionId ? `/simulation/${id}/room` : `/simulation/${id}/panel`)
    } catch (err) {
      console.error("continue session failed:", err)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-12 pb-20 pt-10 max-md:px-5 max-md:pt-7 xl:grid xl:grid-cols-[minmax(0,1fr)_348px] xl:gap-x-16">
      <header className="mb-8 flex items-start gap-3.5 max-md:flex-wrap xl:col-span-2">
        {persona && (
          <PersonaAvatar name={persona.name} available />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[19px] font-semibold leading-tight tracking-[-.015em]">
              {practice.name}
            </h1>
            <LaneBadge packId={practice.packId} />
          </div>
          {persona && (
            <p className="mt-0.5 text-[13px] text-on-surface-2">
              With <b className="font-medium text-on-surface">{persona.name}</b>,{" "}
              {persona.shortRole.toLowerCase()}
            </p>
          )}
        </div>
        <button type="button" onClick={handleContinue} className={cn(BTN_PRIMARY, "pt-2")}>
          <Video className="size-[15px]" />
          Continue
        </button>
      </header>

      <div className="min-w-0">
        <ToWorkOn
          practiceId={id}
          items={practice.continuity?.actionItems ?? []}
          personaFirst={personaFirst}
          materials={materials ?? []}
        />

        <section>
          <div className="mb-2.5 flex items-baseline justify-between px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
              Sessions
            </h2>
            {sessions && sessions.length > 1 && (
              <p className="text-xs text-on-surface-3">newest first</p>
            )}
          </div>
          {sessions === undefined ? null : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 px-5 py-8 text-center text-[13px] text-on-surface-3">
              No sessions yet. Hit Continue to face {personaFirst ?? "your panelist"} for the
              first time.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <Link
                  key={session.sessionId}
                  href={`/p/${practiceId}/s/${session.sessionId}`}
                  className="rounded-xl border border-line bg-surface-raised px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex-1 truncate text-[13.5px]",
                        session.title
                          ? "font-semibold tracking-[-.005em]"
                          : "text-on-surface-2"
                      )}
                    >
                      {session.title ??
                        (session.status === "live"
                          ? "Live now"
                          : session.userTurns === 0 || session.panelistTurns === 0
                            ? "Nothing recorded"
                            : "Session")}
                    </span>
                    {session.verdict && <VerdictBadge decision={session.verdict} />}
                    {session.status === "live" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.07em] text-ok">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
                        Live
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-on-surface-3">
                      {relativeDay(session.startedAt)}
                    </span>
                  </div>
                  {session.quote && (
                    <p className="mt-1.5 font-serif text-[14.5px] italic leading-normal text-on-surface-2">
                      &ldquo;{session.quote}&rdquo;
                    </p>
                  )}
                  {session.turns > 0 && (
                    <p className="mt-1 text-xs text-on-surface-3">
                      {session.turns} {session.turns === 1 ? "turn" : "turns"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {(gaps.length > 0 || openQuestions.length > 0) && (
        <aside className="mt-10 min-w-0 xl:sticky xl:top-10 xl:mt-0" aria-label="Still unproven">
          <div className="mb-2.5 flex items-baseline justify-between px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
              Still unproven
            </h2>
            {personaFirst && (
              <p className="text-xs text-on-surface-3">what {personaFirst} would flag today</p>
            )}
          </div>
          {gaps.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                From your materials
              </p>
              {gaps.map((gap, i) => {
                const expanded = expandedGaps.has(i)
                const dot = (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[7px] h-1.5 w-1.5 flex-none rounded-full",
                      gap.severity === "blocker" ? "bg-red-fg" : "bg-warn"
                    )}
                  />
                )
                const title = (
                  <span className="flex-1 text-[13px] leading-normal text-on-surface-2">
                    <span className="sr-only">{gap.severity}: </span>
                    {gap.title}
                  </span>
                )
                if (!gap.detail) {
                  return (
                    <div key={i} className="flex gap-2.5 border-t border-line py-2 first:border-t-0">
                      {dot}
                      {title}
                    </div>
                  )
                }
                return (
                  <div key={i} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`gap-detail-${i}`}
                      onClick={() => handleToggleGap(i)}
                      className="focus-ring flex w-full items-start gap-2.5 py-2 text-left"
                    >
                      {dot}
                      {title}
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "mt-[3px] size-3.5 flex-none text-ink-4 transition-transform duration-300 ease-brand motion-reduce:transition-none",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>
                    <div
                      id={`gap-detail-${i}`}
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-brand motion-reduce:transition-none",
                        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden" inert={!expanded || undefined}>
                        <p className="pb-2.5 pl-4 text-[12.5px] leading-normal text-on-surface-3">
                          {gap.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          {openQuestions.length > 0 && (
            <>
              <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                Open from the brief
              </p>
              {visibleQuestions.map((question, i) => (
                <div key={i} className="flex gap-2.5 border-t border-line py-2 first:border-t-0">
                  <span className="font-mono text-[11px] text-ink-4">Q·{i + 1}</span>
                  <p className="text-[13px] leading-normal text-on-surface-2">{question}</p>
                </div>
              ))}
              {openQuestions.length > 4 && (
                <button
                  type="button"
                  aria-expanded={showAllQuestions}
                  onClick={handleShowAllQuestions}
                  className="focus-ring flex w-full items-center gap-1.5 border-t border-line py-2 text-[12.5px] text-on-surface-3 transition-colors hover:text-on-surface-2"
                >
                  {showAllQuestions ? "Show fewer" : `Show all ${openQuestions.length}`}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "ml-auto size-3.5 text-ink-4 transition-transform duration-300 ease-brand motion-reduce:transition-none",
                      showAllQuestions && "rotate-180"
                    )}
                  />
                </button>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  )
}

export default PracticePage
