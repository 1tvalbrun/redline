"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { FLOW_BTN, StageKicker } from "@/components/simulation/flow/FlowShell"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"
import { DEFAULT_CHARACTERS } from "../characters"

const ARCHETYPE_ROLES: Record<string, string> = {
  vc: "The VC",
  target_customer: "The buyer",
  technical_architect: "The architect",
}

const CHARACTER_ATTACK: Record<string, React.ReactNode> = {
  "vc-01": (
    <>
      Will open on <b className="text-on-surface">market size and pricing power</b> —
      your TAM and why anyone pays.
    </>
  ),
  "tc-01": (
    <>
      Plays your real customer. Comes for{" "}
      <b className="text-on-surface">switching cost and procurement</b> — why he&apos;d
      rip out what he has.
    </>
  ),
  "ta-01": (
    <>
      Thinks in failure modes. Goes straight at{" "}
      <b className="text-on-surface">feasibility and reliability</b> — accuracy claims,
      latency, what breaks first.
    </>
  ),
}

type PanelSetupProps = {
  simulationId: string
}

export const PanelSetup = ({ simulationId }: PanelSetupProps) => {
  const router = useRouter()
  const typedId = simulationId as Id<"simulations">
  const simulation = useQuery(api.simulations.get, { id: typedId })
  const room = useQuery(api.rooms.getBySimulation, { simulationId: typedId })
  const createRoom = useMutation(api.rooms.create)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [enterFailed, setEnterFailed] = useState(false)

  const handleEnterRoom = async (characterId: string) => {
    const character = DEFAULT_CHARACTERS.find((c) => c.id === characterId)
    if (!character || startingId) return
    setStartingId(characterId)
    setEnterFailed(false)
    const { image: _image, ...charForConvex } = character
    try {
      await createRoom({ simulationId: typedId, characters: [charForConvex] })
      router.push(`/simulation/${simulationId}/room`)
    } catch {
      setEnterFailed(true)
      setStartingId(null)
    }
  }

  if (simulation === undefined || room === undefined) return null
  if (simulation === null) return <IdeaNotFound />

  if (!simulation.context) {
    return (
      <div>
        <StageKicker>Choose your interrogator</StageKicker>
        <p className="text-[13.5px] text-on-surface-2">
          Your brief is still being read — the panel needs it before the questions
          start.{" "}
          <Link
            href={`/simulation/${simulationId}/analyze`}
            className="focus-ring underline hover:text-red-fg"
          >
            Back to the read
          </Link>
          .
        </p>
      </div>
    )
  }

  if (room) {
    return (
      <div>
        <StageKicker>Choose your interrogator</StageKicker>
        <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
          A run is already live.
        </h1>
        <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
          {room.characters[0]?.name} is in the room for this idea
          {room.status === "concluded" ? " — the session has concluded" : ""}. One run
          per stress test for now.
        </p>
        <div className="mt-6">
          <Link
            href={`/simulation/${simulationId}/${room.status === "concluded" ? "report" : "room"}`}
            className={FLOW_BTN}
          >
            {room.status === "concluded" ? "View the verdict" : "Rejoin the room"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <StageKicker>Choose your interrogator</StageKicker>
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.06] tracking-[-.02em]">
        Who do you want to face first?
      </h1>
      <p className="mt-3.5 max-w-[52ch] text-[15.5px] leading-[1.55] text-on-surface-2">
        Each panelist reads your brief before the room opens. Start with whoever you
        least want to talk to — that&apos;s usually the one worth the most.
      </p>

      <div className="mt-5 grid gap-[18px] max-md:grid-cols-1 md:grid-cols-3">
        {DEFAULT_CHARACTERS.map((char) => (
          <button
            key={char.id}
            type="button"
            onClick={() => handleEnterRoom(char.id)}
            disabled={startingId !== null}
            className="focus-ring group overflow-hidden border border-line-2 bg-surface-raised text-left transition-colors duration-200 hover:border-red disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-[#1C1C1E]">
              <Image
                src={char.image}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
              <span className="absolute bottom-3 left-3.5 font-mono text-[9.5px] uppercase tracking-[.16em] text-white [text-shadow:0_1px_5px_rgba(0,0,0,.5)]">
                {ARCHETYPE_ROLES[char.archetypeId]}
              </span>
            </span>
            <span className="block p-4">
              <span className="block font-display text-[19px] font-bold tracking-[-.01em]">
                {char.name}
              </span>
              <span className="mt-[2px] block text-xs text-on-surface-2">{char.role}</span>
              <span className="mt-3 block text-[13px] leading-[1.5] text-on-surface-2">
                {CHARACTER_ATTACK[char.id]}
              </span>
              <span className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 font-mono text-[11px] uppercase tracking-[.06em] text-on-surface transition-colors group-hover:text-red-fg">
                {startingId === char.id ? "Entering the room…" : "Enter the room →"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {enterFailed && (
        <p role="alert" className="mt-4 text-[13px] text-red-fg">
          Couldn&apos;t open the room — check your connection and try again.
        </p>
      )}
    </div>
  )
}
