"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus, Trash2, Video } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { cn, relativeDay } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import { BTN_PRIMARY } from "@/components/shared/buttons"
import { personaInitials } from "@/components/shared/PersonaAvatar"
import { LaneBadge } from "@/components/shared/LaneBadge"
import { PersonaAvatar } from "@/components/shared/PersonaAvatar"
import {
  DeletePracticeDialog,
  DeletePracticeError,
  useDeletePractice,
} from "@/components/shared/DeletePracticeDialog"
import { focusNewPractice, type PracticeRow } from "@/components/layout/AppRail"
import { firstNameOf } from "@/domains/types"

const greeting = (hour: number) =>
  hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

const personaFor = (practice: PracticeRow) =>
  practice.personaId
    ? getPack(practice.packId).personas.find((persona) => persona.id === practice.personaId) ?? null
    : null

const ResumeHero = ({ practice }: { practice: PracticeRow }) => {
  const router = useRouter()
  const continueSession = useMutation(api.practices.continueSession)
  const persona = personaFor(practice)

  const handleContinue = async () => {
    const { sessionId } = await continueSession({ id: practice.practiceId })
    router.push(
      sessionId
        ? `/simulation/${practice.practiceId}/room`
        : `/simulation/${practice.practiceId}/panel`
    )
  }

  const waitingLine =
    practice.openItems > 0 && persona
      ? `${firstNameOf(persona.name)} is waiting on ${practice.openItems === 1 ? "one item" : `${practice.openItems} items`} you said you'd bring.`
      : practice.hasLive
        ? "A session is still live. Step back in."
        : "Pick up where you left off."

  return (
    <section className="mb-12">
      <h2 className="mb-3 px-0.5 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
        Pick up where you left off
      </h2>
      <div className="flex items-center gap-[18px] rounded-2xl border border-line bg-surface-raised px-6 py-5 shadow-card max-md:flex-wrap">
        {persona && (
          <PersonaAvatar name={persona.name} size="lg" available />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] font-semibold tracking-[-.01em]">{practice.name}</span>
            <LaneBadge packId={practice.packId} />
          </div>
          <p className="mt-1 font-serif text-[15.5px] leading-normal text-on-surface-2">
            {waitingLine}
          </p>
          {practice.lastQuote && (
            <p className="mt-1 truncate text-xs text-on-surface-3">
              {relativeDay(practice.lastSessionAt) && `Last session ${relativeDay(practice.lastSessionAt).toLowerCase()} · `}
              &ldquo;{practice.lastQuote}&rdquo;
            </p>
          )}
        </div>
        <button type="button" onClick={handleContinue} className={BTN_PRIMARY}>
          <Video className="size-[15px]" />
          {persona ? `Continue with ${firstNameOf(persona.name)}` : "Continue"}
        </button>
      </div>
    </section>
  )
}

const PracticeCard = ({ practice, onDelete }: { practice: PracticeRow; onDelete: () => void }) => {
  const persona = personaFor(practice)
  const statusLine =
    practice.lastQuote ??
    (practice.status === "ready"
      ? "Brief confirmed, no sessions yet."
      : "Brief in progress. Finish setting up.")
  return (
    // A stretched link rather than a card-as-link: the delete button can't
    // legally nest inside an anchor, so the link overlays the card and the
    // button layers above it.
    <div className="group relative flex min-h-[150px] flex-col rounded-xl border border-line bg-surface-raised p-[17px] shadow-card transition hover:-translate-y-px hover:bg-surface-2">
      <Link
        href={`/p/${practice.practiceId}`}
        aria-label={`Open ${practice.name}`}
        className="focus-ring absolute inset-0 rounded-xl"
      />
      <div className="mb-2.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-.005em]">
          {practice.name}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${practice.name}`}
          className="focus-ring relative grid size-6 flex-none place-items-center rounded-md text-ink-4 opacity-0 transition-opacity hover:bg-surface-3 hover:text-red-fg focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
        <LaneBadge packId={practice.packId} />
      </div>
      {persona && (
        <div className="mb-2.5 flex items-center gap-2">
          <PersonaAvatar name={persona.name} size="sm" />
          <span className="text-[12.5px] text-on-surface-3">
            with {persona.name}, {persona.shortRole.toLowerCase()}
          </span>
        </div>
      )}
      <p
        className={
          practice.lastQuote
            ? "flex-1 font-serif text-[13px] italic leading-normal text-on-surface-2"
            : "flex-1 text-[13px] leading-normal text-on-surface-2"
        }
      >
        {practice.lastQuote ? `“${statusLine}”` : statusLine}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-[11px]">
        <span className="flex-1 text-xs text-on-surface-3">
          {practice.sessionCount === 0
            ? "No sessions yet"
            : `${practice.sessionCount} session${practice.sessionCount === 1 ? "" : "s"} · ${relativeDay(practice.lastSessionAt)}`}
        </span>
        {practice.openItems > 0 && (
          <span className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[11px] font-medium text-accent-blue">
            {practice.openItems} open
          </span>
        )}
        <ChevronRight className="size-3.5 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-accent-blue" />
      </div>
    </div>
  )
}

// First run: no practices yet — the room chooser from the welcome mock,
// rendered as Home so the (empty) sidebar stays in view.
const FirstRun = ({ lanes }: { lanes: string[] }) => (
  <>
    <div className="mb-9 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] justify-center gap-4">
      {lanes.map((laneId) => {
        const pack = getPack(laneId)
        return (
          <Link
            key={laneId}
            href={`/simulation/new?lane=${laneId}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised px-[22px] pb-[18px] pt-[22px] shadow-card transition hover:-translate-y-0.5 hover:bg-surface-2"
          >
            <span className="mb-3.5 flex h-10">
              {pack.personas.slice(0, 3).map((persona, i) => (
                <span
                  key={persona.id}
                  className={cn(
                    "grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-surface-raised bg-surface-2 text-[13px] font-semibold text-on-surface-2",
                    i > 0 && "-ml-2.5"
                  )}
                >
                  {personaInitials(persona.name)}
                </span>
              ))}
            </span>
            <span className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
              {pack.label}
            </span>
            <span className="flex-1 text-[13.5px] leading-normal text-on-surface-2">
              {pack.description}
            </span>
            <span className="mt-4 flex items-center gap-[7px] border-t border-line pt-3.5 text-[13px] font-medium">
              {pack.startCta}
              <ChevronRight className="size-3.5 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-accent-blue" />
            </span>
          </Link>
        )
      })}
    </div>
    <div
      aria-label="How it works"
      className="mb-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-[13px] text-on-surface-3"
    >
      {["Talk your pitch in. A minute is plenty", "Practice live, face to face", "Leave with exactly what to fix"].map(
        (step, i) => (
          <span key={step} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-3.5 text-ink-4" />}
            <span className="grid h-5 w-5 place-items-center rounded-full border border-line-2 bg-surface-raised font-mono text-[10.5px]">
              {i + 1}
            </span>
            {step}
          </span>
        )
      )}
    </div>
    <p className="mx-auto max-w-[520px] text-center text-[11.5px] leading-relaxed text-ink-4">
      Sessions are live voice conversations with an AI avatar. What you get is practice feedback,
      never professional advice or a compliance determination.
    </p>
  </>
)

const HomePage = () => {
  const user = useQuery(api.users.getCurrent)
  const practices = useQuery(api.practices.list)
  const removePractice = useDeletePractice()
  // The target outlives the dialog's open state: clearing it on close would
  // blank the title mid exit animation.
  const [confirmTarget, setConfirmTarget] = useState<PracticeRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const handleRequestDelete = (practice: PracticeRow) => {
    setConfirmTarget(practice)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return
    setConfirmOpen(false)
    setDeleteFailed(false)
    removePractice({ id: confirmTarget.practiceId }).catch(() => setDeleteFailed(true))
    // The optimistic update unmounts the card (and the dialog's trigger with
    // it) immediately, so land keyboard focus somewhere deterministic.
    focusNewPractice()
  }

  if (practices === undefined) return null

  const resume =
    practices.find((practice) => practice.hasLive) ??
    practices.find((practice) => practice.openItems > 0) ??
    (practices[0]?.sessionCount ? practices[0] : undefined)

  const now = new Date()
  const date = now
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const firstName = user?.displayName?.split(" ")[0] ?? "there"
  const lanes = (user?.lanes ?? []).filter(isPackId)

  if (practices.length === 0) {
    return (
      <div className="mx-auto flex min-h-full max-w-[1060px] flex-col justify-center px-12 py-14 max-md:px-5">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[.04em] text-on-surface-3">
          {date}
        </p>
        <h1 className="mb-2.5 text-[27px] font-semibold tracking-[-.02em]">
          Welcome, {firstName}
        </h1>
        <p className="mb-11 max-w-[520px] text-[15px] leading-relaxed text-on-surface-2">
          This is your practice room: <b className="font-medium text-on-surface">the interview
          before the interview</b>. Run it as many times as it takes, fix what gets pointed out,
          and walk into the real thing already ready.
        </p>
        <h2 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
          Choose who to practice with
        </h2>
        <FirstRun lanes={lanes.length > 0 ? lanes : ["founder"]} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-12 pb-20 pt-[52px] max-md:px-5 max-md:pt-8">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[.04em] text-on-surface-3">
        {date}
      </p>
      <h1 className="mb-10 text-[26px] font-semibold tracking-[-.02em]">
        {greeting(now.getHours())}, {firstName}
      </h1>

      {resume && <ResumeHero practice={resume} />}

      <section>
        <div className="mb-3 flex items-baseline justify-between px-0.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
            Your practices
          </h2>
          {practices.length > 0 && (
            <p className="text-xs text-on-surface-3">
              {practices.length} across {new Set(practices.map((p) => p.packId)).size}{" "}
              {new Set(practices.map((p) => p.packId)).size === 1 ? "lane" : "lanes"}
            </p>
          )}
        </div>
        {deleteFailed && <DeletePracticeError className="mb-3 px-0.5" />}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {practices.map((practice) => (
            <PracticeCard
              key={practice.practiceId as Id<"practices">}
              practice={practice}
              onDelete={() => handleRequestDelete(practice)}
            />
          ))}
          <Link
            href="/simulation/new"
            className="col-span-full flex min-h-[130px] w-[min(360px,100%)] flex-col items-center justify-center justify-self-center gap-2.5 rounded-xl border border-dashed border-line-2 text-on-surface-3 transition hover:bg-surface-2 hover:text-on-surface-2"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-2">
              <Plus className="size-[15px]" />
            </span>
            <span className="text-[13px] font-medium">New practice</span>
          </Link>
        </div>
      </section>

      <DeletePracticeDialog
        name={confirmTarget?.name}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default HomePage
