"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, X } from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack } from "@/domains/registry"
import { scopeText } from "@/domains/types"
import { REDIRECT_NOTE_CHARS, ANSWER_CHARS } from "@/lib/blueprint"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { FIELD_INPUT } from "@/components/simulation/intake/ScopeFields"
import { WaitingScreen } from "@/components/simulation/flow/WaitingScreen"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

type BlueprintStageProps = {
  simulationId: string
}

// The interview lane's prep stage: themes visible, questions sealed. The
// user can cut themes, answer clarifying questions, and add one redirect
// note; all of it feeds the single refinement pass, then the plan locks.
export const BlueprintStage = ({ simulationId }: BlueprintStageProps) => {
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const runBlueprint = useAction(api.blueprints.run)
  const requestRefinement = useMutation(api.blueprints.requestRefinement)
  const [startFailed, setStartFailed] = useState(false)
  const [removed, setRemoved] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [redirectNote, setRedirectNote] = useState("")
  const [refineError, setRefineError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoStartedRef = useRef(false)

  const handleRun = () => {
    setStartFailed(false)
    runBlueprint({ id: typedId }).catch(() => setStartFailed(true))
  }

  // Auto-start on first entry, same discipline as the audit stage: the ref
  // stops re-render double-fires; the server's idempotent claim collapses
  // refreshes and concurrent triggers.
  useEffect(() => {
    if (!practice || practice.blueprint || autoStartedRef.current) return
    autoStartedRef.current = true
    runBlueprint({ id: typedId }).catch(() => setStartFailed(true))
  }, [practice, runBlueprint, typedId])

  if (practice === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)
  const prep = pack.prep
  if (prep.kind !== "blueprint") return null
  const copy = prep.copy

  if (!practice.context) {
    return (
      <p className="text-[13.5px] text-on-surface-2">
        Your brief hasn&apos;t been read yet.{" "}
        <Link
          href={`/simulation/${simulationId}/analyze`}
          className="focus-ring underline hover:text-accent-blue"
        >
          Back to the read
        </Link>
        .
      </p>
    )
  }

  const blueprint = practice.blueprint
  if (!blueprint || blueprint.status === "failed" || blueprint.status === "generating") {
    const failed = blueprint?.status === "failed" || startFailed
    return (
      <div>
        {failed ? (
          <>
            <StageKicker>{copy.kicker}</StageKicker>
            <h1 className="max-w-[24ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
              The blueprint hit a wall.
            </h1>
            <p role="alert" className="mt-3 max-w-[52ch] text-[13.5px] text-red-fg">
              {blueprint?.status === "failed"
                ? (blueprint.failureMessage ?? "Something went wrong.")
                : "Couldn't start the blueprint. Check your connection and try again."}
            </p>
            <div className="mt-6">
              <button type="button" onClick={handleRun} className={BTN_PRIMARY}>
                Retry the blueprint <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <WaitingScreen
            kicker={prep.wait.kicker}
            heading={prep.wait.heading(scopeText(practice.scope, pack.subjectField))}
            lead={prep.wait.lead}
            rows={prep.wait.rows}
            work={prep.wait.work}
            ticker={prep.wait.ticker}
            stepMs={prep.wait.stepMs}
          />
        )}
      </div>
    )
  }

  // One pass only: any refinement record — pending or completed — closes
  // the editing affordances for good.
  const locked = blueprint.refinement !== undefined
  const keptThemes = blueprint.themes.filter((theme) => !removed.includes(theme.title))
  const unanswered = blueprint.clarifyingQuestions.filter((entry) => !entry.answer)
  const hasEdits =
    removed.length > 0 ||
    redirectNote.trim().length > 0 ||
    unanswered.some((entry) => (answers[entry.question] ?? "").trim().length > 0)

  const handleToggleTheme = (title: string) => {
    if (locked) return
    setRemoved((current) =>
      current.includes(title)
        ? current.filter((entry) => entry !== title)
        : // The plan needs at least one theme; the server enforces it too.
          keptThemes.length > 1
          ? [...current, title]
          : current
    )
  }

  const handleRefine = async () => {
    if (submitting || !hasEdits) return
    setSubmitting(true)
    setRefineError(null)
    try {
      await requestRefinement({
        id: typedId,
        answers: unanswered
          .map((entry) => ({
            question: entry.question,
            answer: (answers[entry.question] ?? "").trim(),
          }))
          .filter((entry) => entry.answer.length > 0),
        removedThemes: removed,
        redirectNote: redirectNote.trim(),
      })
      setRemoved([])
      setRedirectNote("")
    } catch {
      setRefineError("That didn't go through. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <StageKicker>{copy.kicker}</StageKicker>
      <h1 className="max-w-[26ch] text-[25px] font-semibold leading-[1.2] tracking-[-.02em]">
        {copy.readyHeading}
      </h1>
      <p className="mb-8 mt-2.5 max-w-[56ch] text-[14.5px] leading-relaxed text-on-surface-2">
        {locked
          ? "The plan is locked in. The questions stay sealed until the room."
          : copy.readyLead}
      </p>

      <section aria-label="Interview themes" className="mb-9">
        <h2 className="mb-3 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
          <span>What your interview will probe</span>
          <span className="font-mono text-[10.5px] tracking-[.02em]">
            {keptThemes.length} theme{keptThemes.length === 1 ? "" : "s"} · questions sealed
          </span>
        </h2>
        <ul className="grid gap-3.5 max-md:grid-cols-1 md:grid-cols-2">
          {blueprint.themes.map((theme) => {
            const cut = removed.includes(theme.title)
            return (
              <li
                key={theme.title}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-raised p-4 shadow-card",
                  cut && "opacity-45"
                )}
              >
                <div>
                  <p
                    className={cn(
                      "text-[14px] font-semibold leading-[1.4]",
                      cut && "line-through decoration-ink-4"
                    )}
                  >
                    {theme.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-normal text-on-surface-2">
                    {theme.detail}
                  </p>
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => handleToggleTheme(theme.title)}
                    aria-pressed={cut}
                    aria-label={cut ? `Keep ${theme.title}` : `Remove ${theme.title}`}
                    className="focus-ring mt-0.5 flex-none rounded-md p-1 text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-on-surface"
                  >
                    {cut ? (
                      <Check className="size-[15px]" />
                    ) : (
                      <X className="size-[15px]" />
                    )}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {blueprint.clarifyingQuestions.length > 0 && (
        <section aria-label="Clarifying questions" className="mb-9">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
            Your interviewer asked
          </h2>
          <div className="space-y-3">
            {blueprint.clarifyingQuestions.map((entry) => (
              <div
                key={entry.question}
                className="rounded-xl border border-line bg-surface-raised p-4 shadow-card"
              >
                <p className="text-[13.5px] font-medium leading-normal">{entry.question}</p>
                {entry.answer ? (
                  <p className="mt-2 text-[13px] leading-normal text-on-surface-2">
                    <span aria-hidden="true" className="mr-1.5 font-mono text-ok">✓</span>
                    {entry.answer}
                  </p>
                ) : locked ? (
                  <p className="mt-2 text-[12.5px] text-on-surface-3">Left unanswered.</p>
                ) : (
                  <input
                    type="text"
                    aria-label={entry.question}
                    value={answers[entry.question] ?? ""}
                    maxLength={ANSWER_CHARS}
                    placeholder="Answer inline — it sharpens the plan"
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [entry.question]: event.target.value,
                      }))
                    }
                    className={cn(FIELD_INPUT, "mt-2.5")}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!locked && (
        <section aria-label="Redirect the focus" className="mb-9 max-w-[560px]">
          <h2 className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
            <span>Redirect the focus</span>
            <span className="font-mono text-[10.5px] font-normal normal-case tracking-[.02em] text-ink-4">
              optional
            </span>
          </h2>
          <input
            type="text"
            aria-label="Redirect the focus"
            value={redirectNote}
            maxLength={REDIRECT_NOTE_CHARS}
            placeholder='e.g. "less system design, more people management"'
            onChange={(event) => setRedirectNote(event.target.value)}
            className={FIELD_INPUT}
          />
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3.5">
        {!locked && (
          <button
            type="button"
            onClick={handleRefine}
            disabled={!hasEdits || submitting}
            className={cn(hasEdits ? BTN_PRIMARY : BTN_SECONDARY, "disabled:opacity-50")}
          >
            {submitting ? "Updating the plan" : "Update the plan"}
          </button>
        )}
        <Link
          href={`/simulation/${simulationId}/panel`}
          className={locked || !hasEdits ? BTN_PRIMARY : BTN_SECONDARY}
        >
          {locked ? "To the panel" : copy.cta} <span aria-hidden="true">→</span>
        </Link>
        <span className="text-[12.5px] text-on-surface-3">
          {locked
            ? "One revision was the deal. See you in the room."
            : unanswered.length > 0
              ? "Unanswered questions are fine — they just leave the plan broader."
              : "One revision, then it locks."}
        </span>
      </div>

      {refineError && (
        <p role="alert" className="mt-5 text-[13px] text-red-fg">
          {refineError}
        </p>
      )}
    </div>
  )
}
