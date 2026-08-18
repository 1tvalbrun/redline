"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Video } from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { verdictDirection } from "@/domains/registry"
import { bySpokenTime } from "@/lib/transcript"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { PersonaAvatar } from "@/components/shared/PersonaAvatar"
import { Disclosure } from "@/components/shared/Disclosure"
import { VerdictBadge } from "@/components/workspace/VerdictBadge"
import { firstNameOf } from "@/domains/types"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

// Generation normally lands well inside this; the retry only appears once
// the wait is genuinely unusual, so it can't be mashed on arrival.
const RETRY_AFTER_MS = 12_000

const SessionPage = ({
  params,
}: {
  params: Promise<{ practiceId: string; sessionId: string }>
}) => {
  const { practiceId, sessionId } = use(params)
  const router = useRouter()
  const session = useQuery(api.sessions.get, { id: sessionId as Id<"sessions"> })
  const practice = useQuery(api.practices.get, { id: practiceId as Id<"practices"> })
  const siblings = useQuery(api.sessions.listByPractice, {
    practiceId: practiceId as Id<"practices">,
  })
  const setItemStatus = useMutation(api.practices.setActionItemStatus)
  const continueSession = useMutation(api.practices.continueSession)
  const generateDebrief = useAction(api.sessions.generateDebrief)
  const transcriptScroll = useAutoHideScrollbar<HTMLDivElement>()

  // Once the debrief lands the pending branch unmounts for good, so the
  // flag never needs resetting.
  const debriefPending = session?.status === "concluded" && !session.debrief
  const [showRetry, setShowRetry] = useState(false)
  useEffect(() => {
    if (!debriefPending) return
    const timer = setTimeout(() => setShowRetry(true), RETRY_AFTER_MS)
    return () => clearTimeout(timer)
  }, [debriefPending])

  if (session === undefined || practice === undefined) return null
  if (session === null || practice === null) {
    return (
      <div className="mx-auto max-w-[640px] px-8 pt-24 text-center">
        <p className="text-[15px] text-on-surface-2">This session doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-accent-blue hover:underline">
          Back home
        </Link>
      </div>
    )
  }

  const debrief = session.debrief ?? null
  // The tier movement against the previous debriefed session, spoken as
  // direction only — no numbers anywhere.
  const previousVerdict =
    (siblings ?? [])
      .filter((s) => s.startedAt < session._creationTime && s.verdict)
      .map((s) => s.verdict)[0] ?? null
  const direction = debrief ? verdictDirection(previousVerdict, debrief.verdict) : null
  const sessionItems = (practice.continuity?.actionItems ?? []).filter(
    (item) => item.fromSessionId === session._id
  )

  const handleRetryDebrief = () => {
    generateDebrief({ sessionId: session._id }).catch((err) =>
      console.error("debrief retry failed:", err)
    )
  }

  const handlePracticeAgain = async () => {
    const { sessionId: nextId } = await continueSession({ id: practice._id })
    router.push(nextId ? `/simulation/${practice._id}/room` : `/simulation/${practice._id}/panel`)
  }

  const transcript = bySpokenTime(session.transcript)

  return (
    <div className="mx-auto max-w-[1200px] px-12 pb-24 pt-11 max-md:px-5 max-md:pt-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-mono text-[11px] font-normal uppercase tracking-[.06em] text-on-surface-3">
          The debrief · <b className="font-medium text-on-surface-2">{practice.name}</b>
        </h1>
        <Link
          href={`/p/${practiceId}`}
          className="focus-ring rounded-lg px-2.5 py-1.5 text-[13px] text-on-surface-3 transition-colors hover:bg-surface-2"
        >
          Close
        </Link>
      </div>

      {debrief ? (
        <>
          <header className="mb-10">
            <div className="mb-4 flex items-center gap-2.5">
              <VerdictBadge decision={debrief.verdict} />
              {direction === "up" && (
                <span className="text-xs font-medium text-ok">up from last time</span>
              )}
              {direction === "down" && (
                <span className="text-xs font-medium text-warn">down from last time</span>
              )}
            </div>
            <blockquote className="max-w-[30em] font-serif text-[27px] font-normal leading-[1.42] max-md:text-[22px]">
              <span aria-hidden="true" className="text-ink-4">
                &ldquo;
              </span>
              {debrief.spokenVerdict.text}
              <span aria-hidden="true" className="text-ink-4">
                &rdquo;
              </span>
            </blockquote>
            <div className="mt-3.5 flex items-center gap-2.5">
              <PersonaAvatar name={session.persona.name} size="sm" />
              <p className="text-[13px] text-on-surface-2">
                <b className="font-medium text-on-surface">{session.persona.name}</b>
                <span className="text-ink-4"> · </span>spoken at the end of your session
              </p>
            </div>
          </header>

          <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-x-16 max-lg:grid-cols-1">
            <div className="min-w-0">
              {debrief.whatHappened && (
                <section className="mb-8">
                  <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                    What happened in there
                  </h2>
                  <p className="max-w-[44em] text-sm leading-[1.7] text-on-surface-2">
                    {debrief.whatHappened}
                  </p>
                </section>
              )}

              {sessionItems.length > 0 && (
                <section className="mb-7">
                  <div className="mb-2.5 flex items-baseline justify-between px-0.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                      Added to your list
                    </h2>
                    <p className="text-xs text-on-surface-3">uncheck to drop</p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
                    {sessionItems.map((item) => {
                      const kept = item.status !== "dropped"
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="checkbox"
                          aria-checked={kept}
                          onClick={() =>
                            setItemStatus({
                              practiceId: practice._id,
                              itemId: item.id,
                              status: kept ? "dropped" : "open",
                            })
                          }
                          className={cn(
                            "flex w-full items-start gap-3 border-b border-line px-4 py-[11px] text-left transition hover:bg-surface-2 last:border-b-0",
                            !kept && "opacity-55"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-md border-[1.5px]",
                              kept ? "border-accent-blue bg-accent-blue" : "border-line-2"
                            )}
                          >
                            {kept && (
                              <Check className="size-[11px] text-white" strokeWidth={3.4} />
                            )}
                          </span>
                          <span
                            className={cn(
                              "flex-1 text-[13.5px] leading-snug",
                              !kept && "text-on-surface-3 line-through decoration-ink-4"
                            )}
                          >
                            {item.text}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 rounded-full border px-2 py-px font-mono text-[10px] uppercase",
                              item.priority === "low"
                                ? "border-line-2 bg-surface-2 text-on-surface-3"
                                : "border-warn-line bg-warn-bg text-warn",
                              !kept && "opacity-40"
                            )}
                          >
                            {item.priority === "medium" ? "med" : item.priority}
                          </span>
                        </button>
                      )
                    })}
                    <div className="flex items-center gap-2 border-t border-line bg-surface px-4 py-[11px] text-[12.5px] text-on-surface-3">
                      <Check className="size-3.5" />
                      {firstNameOf(session.persona.name)} follows up on these next session.
                    </div>
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/p/${practiceId}`} className={BTN_PRIMARY}>
                  Done
                </Link>
                <button
                  type="button"
                  onClick={handlePracticeAgain}
                  className={BTN_SECONDARY}
                >
                  <Video className="size-[14px]" />
                  Go again
                </button>
              </div>
            </div>

            <aside className="mt-10 min-w-0 lg:sticky lg:top-10 lg:mt-0" aria-label="Under pressure">
              <div className="mb-3 flex items-baseline justify-between px-0.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
                  Under pressure
                </h2>
                <p className="text-xs text-on-surface-3">only your actual words count</p>
              </div>

              {debrief.heldUp.length > 0 && (
                <>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-[17px] w-[17px] place-items-center rounded-[5px] bg-ok-bg text-[10px] font-bold text-ok">
                      ✓
                    </span>
                    <p className="text-xs font-semibold tracking-[.02em]">What held up</p>
                  </div>
                  {debrief.heldUp.map((finding, i) => (
                    <div key={i} className="border-t border-line py-2.5 first:border-t-0">
                      <p className="font-serif text-sm italic leading-normal">
                        <span aria-hidden="true" className="text-ok">
                          &ldquo;
                        </span>
                        {finding.quote}
                        <span aria-hidden="true" className="text-ok">
                          &rdquo;
                        </span>
                      </p>
                      <p className="mt-1 text-xs leading-normal text-on-surface-3">
                        {finding.why}
                      </p>
                    </div>
                  ))}
                  <div className="h-5" />
                </>
              )}

              {debrief.didntHold.length > 0 && (
                <>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-[17px] w-[17px] place-items-center rounded-[5px] bg-red-fg/10 text-[10px] font-bold text-red-fg">
                      ✕
                    </span>
                    <p className="text-xs font-semibold tracking-[.02em]">What didn&apos;t</p>
                  </div>
                  {debrief.didntHold.map((gap, i) => (
                    <div key={i} className="border-t border-line py-2.5 first:border-t-0">
                      <p className="text-[13px] leading-normal text-on-surface-2">{gap.text}</p>
                      {gap.ref && (
                        <span className="mt-0.5 block font-mono text-[10.5px] text-red-fg">
                          {gap.ref}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}

              {(debrief.verifyItems ?? []).length > 0 && (
                <>
                  <div className="mb-1.5 mt-5 flex items-center gap-2">
                    <span className="grid h-[17px] w-[17px] place-items-center rounded-[5px] bg-accent-bg text-[10px] font-bold text-accent-blue">
                      !
                    </span>
                    <p className="text-xs font-semibold tracking-[.02em]">
                      Verify before the real thing
                    </p>
                  </div>
                  <p className="mb-1 text-xs leading-normal text-on-surface-3">
                    Not weak answers — facts your interviewer couldn&apos;t vouch for. Check
                    them with an official source.
                  </p>
                  {(debrief.verifyItems ?? []).map((item, i) => (
                    <div key={i} className="border-t border-line py-2.5 first:border-t-0">
                      <p className="text-[13px] leading-normal text-on-surface-2">{item.text}</p>
                    </div>
                  ))}
                </>
              )}
            </aside>
          </div>

          <Disclosure className="mt-12" />
        </>
      ) : session.status === "live" ? (
        <div className="mb-10 rounded-xl border border-dashed border-line-2 px-6 py-10 text-center">
          <p className="text-[14px] text-on-surface-2">
            This session is still live. The debrief lands when it ends.
          </p>
          <Link
            href={`/simulation/${practiceId}/room`}
            className={cn(BTN_PRIMARY, "mt-4 inline-flex")}
          >
            <Video className="size-[15px]" />
            Rejoin the session
          </Link>
        </div>
      ) : (
        // Concluded with no debrief yet: generation is in flight. This is a
        // live query, so the debrief replaces this block the moment it
        // lands; the retry covers a generation that died (idempotent).
        <div className="mb-10 rounded-xl border border-dashed border-line-2 px-6 py-10 text-center">
          <p className="flex items-center justify-center gap-2.5 text-[14px] text-on-surface-2">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent-blue" />
            {firstNameOf(session.persona.name)} is writing your debrief. It lands here in a
            moment.
          </p>
          {showRetry && (
            <button
              type="button"
              onClick={handleRetryDebrief}
              className={cn(BTN_SECONDARY, "mt-4 px-4 py-2 text-[13px]")}
            >
              Taking too long? Retry
            </button>
          )}
        </div>
      )}

      {transcript.length > 0 && (
        <details className="mt-14 border-t border-line pt-6">
          <summary className="cursor-pointer text-[13px] font-medium text-on-surface-2 hover:text-accent-blue">
            Read the full transcript · {transcript.length} {transcript.length === 1 ? "turn" : "turns"}
          </summary>
          <div
            ref={transcriptScroll}
            className="scrollbar-subtle mt-5 max-h-[60vh] max-w-[52em] space-y-4 overflow-y-auto overscroll-contain pr-2"
          >
            {transcript.map((entry, i) => (
              <div key={i}>
                <p
                  className={cn(
                    "mb-0.5 text-[10.5px] font-semibold uppercase tracking-[.08em]",
                    entry.type === "user" ? "text-accent-blue" : "text-on-surface-3"
                  )}
                >
                  {entry.speakerName}
                </p>
                <p
                  className={cn(
                    "text-[13px] leading-relaxed text-on-surface-2",
                    entry.type === "panelist" && "font-serif text-sm italic text-on-surface"
                  )}
                >
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export default SessionPage
