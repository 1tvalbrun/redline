"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, FileText } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack } from "@/domains/registry"
import { firstNameOf, scopeList, scopeText, type DomainPack, type Persona, type Scope } from "@/domains/types"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"
import { StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// An honest recommendation: the persona whose declared territory (tags +
// attack line) overlaps the thing the user asked to have challenged. No
// match, no invented reason — the first panelist with a generic pill.
const recommendPersona = (
  pack: DomainPack,
  scope: Scope,
  previousPersonaId: string | null
): { persona: Persona; reason: string } => {
  if (previousPersonaId) {
    const previous = pack.personas.find((p) => p.id === previousPersonaId)
    if (previous) {
      return { persona: previous, reason: `You faced ${firstNameOf(previous.name)} last time` }
    }
  }
  const focus = scopeList(scope, "focusAreas")[0] ?? scopeText(scope, "focusAreas")
  if (focus) {
    const words = focus.toLowerCase().split(/\s+/).filter((word) => word.length > 3)
    for (const persona of pack.personas) {
      const territory = [
        ...persona.tags,
        ...persona.attack.map((segment) => segment.text),
      ]
        .join(" ")
        .toLowerCase()
      if (words.some((word) => territory.includes(word))) {
        return { persona, reason: `Targets ${focus.toLowerCase()}` }
      }
    }
  }
  return { persona: pack.personas[0], reason: "A strong first read" }
}

const PortraitTile = ({ persona, className }: { persona: Persona; className?: string }) => (
  <div className={cn("relative overflow-hidden bg-surface-2", className)}>
    <Image
      src={persona.image}
      alt={`${persona.name}, ${persona.role}`}
      fill
      sizes="(max-width: 768px) 100vw, 320px"
      className="object-cover"
    />
    <span className="absolute bottom-2 left-2.5 font-mono text-[10px] font-medium uppercase tracking-[.1em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.45)]">
      {persona.shortRole}
    </span>
  </div>
)

const AttackLine = ({ persona }: { persona: Persona }) => (
  <p className="text-[13px] leading-normal text-on-surface-2">
    {persona.attack.map((segment, i) => (
      <span key={i} className={segment.strong ? "font-medium text-on-surface" : undefined}>
        {segment.text}
      </span>
    ))}
  </p>
)

const ReceiptChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface-raised px-3 py-1 text-xs text-on-surface-2">
    <FileText className="size-[11px] text-on-surface-3" />
    {children}
  </span>
)

const CONSENT =
  "Sessions are live voice conversations with an AI avatar. Entering the room is your consent to your audio being transcribed and the conversation being processed, and possibly recorded, by our avatar provider to run the session."

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const liveSession = useQuery(api.sessions.getLive, { practiceId: typedId })
  const materials = useQuery(api.materials.listByPractice, { practiceId: typedId })
  const createSession = useMutation(api.sessions.create)
  const [startingId, setStartingId] = useState<string | null>(null)
  // Which card carries the highlight and the filled button. Starts on the
  // recommendation, follows the user's click; the recommendation pill
  // stays pinned to the recommended card either way.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enterFailed, setEnterFailed] = useState(false)

  const handleEnterRoom = async (personaId: string) => {
    if (startingId) return
    setStartingId(personaId)
    setEnterFailed(false)
    try {
      await createSession({ practiceId: typedId, personaId })
      router.push(`/simulation/${simulationId}/room`)
    } catch {
      setEnterFailed(true)
      setStartingId(null)
    }
  }

  if (practice === undefined || liveSession === undefined) return null
  if (practice === null) return <IdeaNotFound />
  const pack = getPack(practice.packId)

  if (!practice.context) {
    return (
      <div>
        <StageKicker>{pack.copy.panel.kicker}</StageKicker>
        <p className="text-[13.5px] text-on-surface-2">
          Your brief is still being read. The panel needs it before the questions start.{" "}
          <Link
            href={`/simulation/${simulationId}/analyze`}
            className="focus-ring underline hover:text-accent-blue"
          >
            Back to the read
          </Link>
          .
        </p>
      </div>
    )
  }

  // startingId wins over liveSession: createSession commits the live
  // session before navigation lands, and the reactive query would flash
  // the rejoin branch during the transition.
  if (liveSession && !startingId) {
    return (
      <div className="mx-auto max-w-[560px] pt-10 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-.02em]">A session is already live.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-on-surface-2">
          {liveSession.persona.name} is in the room for this practice. Rejoin to pick up where
          you left off.
        </p>
        <Link
          href={`/simulation/${simulationId}/room`}
          className={cn(BTN_PRIMARY, "mt-6 inline-flex")}
        >
          Rejoin the room <ArrowRight className="size-3.5" />
        </Link>
      </div>
    )
  }

  const gapCount = practice.audit?.status === "ready" ? practice.audit.gaps.length : 0
  const docChips = (materials ?? []).map((material) => material.name)
  const trio = pack.personas.length > 1
  const recommended = recommendPersona(pack, practice.scope, practice.personaId ?? null)

  return (
    <div className="mx-auto max-w-[980px] text-center">
      <h1 className="text-[24px] font-semibold tracking-[-.02em]">{pack.copy.panel.heading}</h1>
      <p className="mx-auto mb-9 mt-2.5 max-w-[54ch] text-sm leading-relaxed text-on-surface-2">
        {trio ? "All three have" : `${firstNameOf(pack.personas[0].name)} has`} read your brief
        {docChips.length > 0 && " and your documents"}. {pack.copy.panel.lead}
      </p>

      {trio ? (
        <div className="grid grid-cols-3 items-stretch gap-4 text-left max-md:grid-cols-1">
          {pack.personas.map((persona) => {
            const isRecommended = persona.id === recommended.persona.id
            const isSelected = (selectedId ?? recommended.persona.id) === persona.id
            return (
              <div
                key={persona.id}
                onClick={() => setSelectedId(persona.id)}
                className={cn(
                  // Selection weight comes from a ring (box-shadow), never a
                  // thicker border — border width changes reflow the text.
                  "relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-surface-raised shadow-card transition-colors",
                  isSelected ? "border-accent-blue ring-1 ring-accent-blue" : "border-line"
                )}
              >
                {isRecommended && (
                  <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-blue px-3 py-[3px] text-[10px] font-semibold uppercase tracking-[.07em] text-primary-foreground">
                    Recommended · {recommended.reason.toLowerCase()}
                  </span>
                )}
                <PortraitTile persona={persona} className="aspect-[5/3] w-full flex-none" />
                <div className="flex flex-1 flex-col px-5 pb-4 pt-4">
                  <p className="text-base font-semibold tracking-[-.01em]">{persona.name}</p>
                  <p className="mb-2.5 mt-0.5 text-[12.5px] text-on-surface-3">{persona.role}</p>
                  {/* Spare height collects here, so the divider and quote sit
                      at the same position on every card. */}
                  <div className="flex-1 pb-3">
                    <AttackLine persona={persona} />
                  </div>
                  <p className="border-t border-line pt-3 font-serif text-sm italic leading-normal text-on-surface-2">
                    &ldquo;{persona.signature}&rdquo;
                  </p>
                </div>
                <div className="px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => handleEnterRoom(persona.id)}
                    // Tabbing moves the highlight exactly like clicking the
                    // card does — keyboard and mouse see the same selection.
                    onFocus={() => setSelectedId(persona.id)}
                    disabled={startingId !== null}
                    className={cn(
                      isSelected ? BTN_PRIMARY : BTN_SECONDARY,
                      "w-full"
                    )}
                  >
                    {startingId === persona.id
                      ? "Opening the room"
                      : `Practice with ${firstNameOf(persona.name)}`}
                    {isSelected && startingId === null && <ArrowRight className="size-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mx-auto max-w-[660px] overflow-hidden rounded-2xl border border-line bg-surface-raised text-left shadow-card">
          <div className="flex gap-6 p-7 pb-5 max-md:flex-col">
            <PortraitTile
              persona={pack.personas[0]}
              className="h-24 w-24 flex-none rounded-xl max-md:h-40 max-md:w-full"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-on-surface-3">
                {pack.shortLabel}
                {scopeText(practice.scope, "controlArea") &&
                  ` · ${scopeText(practice.scope, "controlArea")}`}
              </p>
              <p className="text-[19px] font-semibold tracking-[-.015em]">
                {pack.personas[0].name}
              </p>
              <p className="mb-2.5 mt-0.5 text-[13px] text-on-surface-3">
                {pack.personas[0].role}
              </p>
              <AttackLine persona={pack.personas[0]} />
              <p className="mt-3 font-serif text-[15px] italic leading-normal text-on-surface-2">
                &ldquo;{pack.personas[0].signature}&rdquo;
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-7 py-3.5">
            <span className="text-xs text-on-surface-3">
              {firstNameOf(pack.personas[0].name)}&apos;s read:
            </span>
            <ReceiptChip>Your brief</ReceiptChip>
            {docChips.map((name) => (
              <ReceiptChip key={name}>{name}</ReceiptChip>
            ))}
            {gapCount > 0 && <ReceiptChip>The gap map · {gapCount} open</ReceiptChip>}
          </div>
          <div className="flex flex-wrap items-center gap-3.5 border-t border-line px-7 py-4">
            <button
              type="button"
              onClick={() => handleEnterRoom(pack.personas[0].id)}
              disabled={startingId !== null}
              className={BTN_PRIMARY}
            >
              {startingId ? "Opening the room" : "Enter the room"}
              {!startingId && <ArrowRight className="size-3.5" />}
            </button>
            <span className="text-[12.5px] text-on-surface-3">{pack.copy.panel.lead}</span>
          </div>
        </div>
      )}

      {trio && (
        <p className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-on-surface-3">
          They&apos;ve all read:
          <ReceiptChip>Your brief</ReceiptChip>
          {docChips.map((name) => (
            <ReceiptChip key={name}>{name}</ReceiptChip>
          ))}
          <span>· You can face the others in later sessions.</span>
        </p>
      )}

      {enterFailed && (
        <p role="alert" className="mt-5 text-[13px] text-red-fg">
          Couldn&apos;t open the room. Check your connection and try again.
        </p>
      )}

      <p className="mx-auto mt-9 max-w-[560px] text-[11.5px] leading-relaxed text-ink-4">
        {CONSENT}
      </p>
    </div>
  )
}
