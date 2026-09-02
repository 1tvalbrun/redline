"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FileDown, Video } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { cn, relativeDay } from "@/lib/utils"
import { parseOpenQuestions } from "@/lib/export"
import { getPack } from "@/domains/registry"
import { firstNameOf } from "@/domains/types"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { LaneBadge } from "@/components/shared/LaneBadge"
import { PersonaAvatar } from "@/components/shared/PersonaAvatar"
import { ToWorkOn } from "@/components/workspace/ToWorkOn"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

type SessionRow = {
  sessionId: string
  status: string
  startedAt: number
  turns: number
  userTurns: number
  panelistTurns: number
  title: string | null
  verdict: string | null
  quote: string | null
}

const sessionLabel = (session: SessionRow): string =>
  session.title ??
  (session.status === "live"
    ? "Live now"
    : session.userTurns === 0 || session.panelistTurns === 0
      ? "Nothing recorded"
      : "Session")

const sessionNote = (session: SessionRow): string =>
  session.status === "live"
    ? "In the room now."
    : session.userTurns === 0 || session.panelistTurns === 0
      ? "This one never became a conversation. Nothing counts against you."
      : "Debrief pending."

// The earlier-sessions ledger: uniform two-line rows (quote when the
// session has one, an honest note when it doesn't) inside a capped scroll
// area, so a hundred sessions never grow the page. Its own component so
// the scrollbar hook's mount effect runs when the ledger exists — sessions
// load after the page's first paint.
const EarlierSessions = ({
  practiceId,
  sessions,
}: {
  practiceId: string
  sessions: SessionRow[]
}) => {
  const scrollRef = useAutoHideScrollbar<HTMLDivElement>()
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
      <div
        ref={scrollRef}
        className="scrollbar-subtle max-h-[304px] overflow-y-auto overscroll-contain"
      >
        {sessions.map((session) => (
          <Link
            key={session.sessionId}
            href={`/p/${practiceId}/s/${session.sessionId}`}
            className="flex items-start gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
          >
            <span className="w-[74px] flex-none pt-0.5 font-mono text-[11px] text-on-surface-3">
              {relativeDay(session.startedAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "truncate text-[13.5px]",
                    session.title ? "font-semibold tracking-[-.005em]" : "text-on-surface-2"
                  )}
                >
                  {sessionLabel(session)}
                </span>
                {session.verdict && <VerdictBadge decision={session.verdict} />}
              </span>
              {session.quote ? (
                <span className="mt-0.5 block truncate font-serif text-[13px] italic leading-normal text-on-surface-2">
                  &ldquo;{session.quote}&rdquo;
                </span>
              ) : (
                <span className="mt-0.5 block truncate text-[12.5px] text-on-surface-3">
                  {sessionNote(session)}
                </span>
              )}
            </span>
            {session.turns > 0 && (
              <span className="flex-none pt-0.5 font-mono text-[11px] text-on-surface-3 max-md:hidden">
                {session.turns} {session.turns === 1 ? "turn" : "turns"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

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
  const openQuestions = parseOpenQuestions(practice.context?.openQuestions)
  const visibleQuestions = showAllQuestions ? openQuestions : openQuestions.slice(0, 4)
  const hasExportContent = practice.audit?.status === "ready" || (sessions ?? []).length > 0

  const handleContinue = async () => {
    try {
      const { sessionId } = await continueSession({ id })
      router.push(sessionId ? `/simulation/${id}/room` : `/simulation/${id}/panel`)
    } catch (err) {
      console.error("continue session failed:", err)
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] px-12 pb-20 pt-10 max-lg:px-6 max-md:px-5 max-md:pt-7 xl:grid xl:grid-cols-[minmax(0,1fr)_348px] xl:gap-x-28">
      <header className="mb-8 flex items-start gap-3.5 max-md:flex-wrap max-md:gap-y-4 xl:col-span-2">
        {persona && (
          <PersonaAvatar name={persona.name} available />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="break-words text-[19px] font-semibold leading-tight tracking-[-.015em]">
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
        {/* One flex item so the actions travel together: beside the title on
            desktop, wrapping to their own full row below md instead of
            squeezing the title into a sliver. */}
        <div className="flex items-start gap-3.5 max-md:w-full max-md:items-center">
          {hasExportContent && (
            <a
              href={`/api/export?practiceId=${id}`}
              className="focus-ring mt-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-accent-blue max-md:mt-0 max-md:py-2.5"
            >
              <FileDown className="size-3.5" />
              Export PDF
            </a>
          )}
          <button
            type="button"
            onClick={handleContinue}
            className={cn(BTN_PRIMARY, "pt-2 max-md:ml-auto max-md:pt-2.5")}
          >
            <Video className="size-[15px]" />
            Continue
          </button>
        </div>
      </header>

      <div className="min-w-0">
        <ToWorkOn
          practiceId={id}
          items={practice.continuity?.actionItems ?? []}
          personaFirst={personaFirst}
          materials={materials ?? []}
        />

        <section>
          {sessions === undefined ? null : sessions.length === 0 ? (
            <>
              <div className="mb-2.5 flex items-baseline justify-between px-0.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                  Sessions
                </h2>
              </div>
              <div className="rounded-xl border border-dashed border-line-2 px-5 py-8 text-center text-[13px] text-on-surface-3">
                No sessions yet. Hit Continue to face {personaFirst ?? "your panelist"} for the
                first time.
              </div>
            </>
          ) : (
            <>
              <div className="mb-2.5 flex items-baseline justify-between px-0.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                  Latest session
                </h2>
                <p className="text-xs text-on-surface-3">{relativeDay(sessions[0].startedAt)}</p>
              </div>
              <Link
                href={`/p/${practiceId}/s/${sessions[0].sessionId}`}
                className="block rounded-xl border border-line bg-surface-raised px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex-1 truncate text-[13.5px]",
                      sessions[0].title
                        ? "font-semibold tracking-[-.005em]"
                        : "text-on-surface-2"
                    )}
                  >
                    {sessionLabel(sessions[0])}
                  </span>
                  {sessions[0].verdict && <VerdictBadge decision={sessions[0].verdict} />}
                  {sessions[0].status === "live" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.07em] text-ok">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
                      Live
                    </span>
                  )}
                </div>
                {sessions[0].quote ? (
                  <p className="mt-1.5 font-serif text-[14.5px] italic leading-normal text-on-surface-2">
                    &ldquo;{sessions[0].quote}&rdquo;
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-on-surface-3">
                    {sessionNote(sessions[0])}
                  </p>
                )}
                {sessions[0].turns > 0 && (
                  <p className="mt-1 text-xs text-on-surface-3">
                    {sessions[0].turns} {sessions[0].turns === 1 ? "turn" : "turns"}
                  </p>
                )}
              </Link>
              {sessions.length > 1 && (
                <>
                  <div className="mb-2.5 mt-7 flex items-baseline justify-between px-0.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                      Earlier
                    </h2>
                    <p className="text-xs text-on-surface-3">
                      {sessions.length - 1} {sessions.length === 2 ? "session" : "sessions"} ·
                      newest first
                    </p>
                  </div>
                  <EarlierSessions practiceId={practiceId} sessions={sessions.slice(1)} />
                </>
              )}
            </>
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
