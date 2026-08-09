"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack } from "@/domains/registry"
import type { AttackSegment } from "@/domains/types"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

const Attack = ({ segments }: { segments: AttackSegment[] }) => (
  <>
    {segments.map((segment, i) =>
      segment.strong ? (
        <b key={i} className="text-on-surface">
          {segment.text}
        </b>
      ) : (
        <span key={i}>{segment.text}</span>
      )
    )}
  </>
)

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"practices">
  const practice = useQuery(api.practices.get, { id: typedId })
  const liveSession = useQuery(api.sessions.getLive, { practiceId: typedId })
  const createSession = useMutation(api.sessions.create)
  const [startingId, setStartingId] = useState<string | null>(null)
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
          Your brief is still being read. The panel needs it before the questions
          start.{" "}
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
      <div>
        <StageKicker>{pack.copy.panel.kicker}</StageKicker>
        <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
          A session is already live.
        </h1>
        <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
          {liveSession.persona.name} is in the room for this practice. Rejoin to
          pick up where you left off.
        </p>
        <div className="mt-6">
          <Link href={`/simulation/${simulationId}/room`} className={FLOW_BTN}>
            Rejoin the room <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    )
  }

  const recommendedId = practice.personaId ?? pack.personas[0]?.id ?? null

  return (
    <div>
      <StageKicker>{pack.copy.panel.kicker}</StageKicker>
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        {pack.copy.panel.heading}
      </h1>
      <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
        {pack.copy.panel.lead}
      </p>

      <div
        className={cn(
          "mt-5 grid gap-[18px] max-md:grid-cols-1",
          pack.personas.length > 1 ? "md:grid-cols-3" : "md:max-w-[360px]"
        )}
      >
        {pack.personas.map((char) => (
          <button
            key={char.id}
            type="button"
            onClick={() => handleEnterRoom(char.id)}
            disabled={startingId !== null}
            className={cn(
              "focus-ring group overflow-hidden border text-left transition-colors duration-200 hover:border-accent-blue disabled:pointer-events-none disabled:opacity-60",
              char.id === recommendedId ? "border-accent-blue" : "border-line-2",
              "bg-surface-raised"
            )}
          >
            {char.id === recommendedId && (
              <span className="block bg-accent-blue px-3 py-[5px] font-mono text-[9px] uppercase tracking-[.1em] text-primary-foreground">
                {practice.personaId
                  ? "Recommended · you've worked together before"
                  : "Recommended"}
              </span>
            )}
            <span className="relative block aspect-[4/3] overflow-hidden bg-[#1C1C1E]">
              <Image
                src={char.image}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
              <span className="absolute bottom-3 left-3.5 font-mono text-[9.5px] uppercase tracking-[.16em] text-white [text-shadow:0_1px_5px_rgba(0,0,0,.5)]">
                {char.shortRole}
              </span>
            </span>
            <span className="block p-4">
              <span className="block font-display text-[19px] font-bold tracking-[-.01em]">
                {char.name}
              </span>
              <span className="mt-[2px] block text-xs text-on-surface-2">{char.role}</span>
              <span className="mt-3 block text-[13px] leading-[1.5] text-on-surface-2">
                <Attack segments={char.attack} />
              </span>
              <span className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 font-mono text-[11px] uppercase tracking-[.06em] text-on-surface transition-colors group-hover:text-accent-blue">
                {startingId === char.id ? "Entering the room…" : "Enter the room →"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {enterFailed && (
        <p role="alert" className="mt-4 text-[13px] text-red-fg">
          Couldn&apos;t open the room. Check your connection and try again.
        </p>
      )}
      <p className="mt-5 max-w-[62ch] font-mono text-[9.5px] uppercase leading-[1.7] tracking-[.08em] text-on-surface-2">
        Sessions are live voice conversations with an AI avatar. Entering the room is your
        consent to your audio being transcribed and the conversation being processed, and
        possibly recorded, by our avatar provider to run the session.
      </p>
    </div>
  )
}
