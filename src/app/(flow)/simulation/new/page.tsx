"use client"

import { use, useCallback, useEffect, useReducer, useState } from "react"
import { useRouter } from "next/navigation"
import { Mic } from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { getPack, isPackId } from "@/domains/registry"
import { initialFormState, laneFormsReducer, type IntakeFormAction } from "@/lib/intakeForm"
import type { Scope } from "@/domains/types"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { TellIt } from "@/components/simulation/intake/TellIt"
import { TypedForm } from "@/components/simulation/intake/TypedForm"
import { ConfirmBrief } from "@/components/simulation/intake/ConfirmBrief"
import { useMaterialUploads } from "@/components/simulation/intake/materialUploads"
import { useAutoHideScrollbar } from "@/components/shared/useAutoHideScrollbar"

type Beat =
  | { kind: "tell" }
  | { kind: "type" }
  | { kind: "extracting" }
  | { kind: "confirm"; heard: Scope; seconds: number }

// Voice-first intake for every lane. ?lane= wins over the user's default;
// ?from= prefills the typed form from an existing practice's scope (and
// pins its lane) so adjusting a brief never means retyping it.
const NewPracticePage = ({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; from?: string }>
}) => {
  const { lane, from } = use(searchParams)
  const router = useRouter()
  const user = useQuery(api.users.getCurrent)
  const source = useQuery(api.practices.get, from ? { id: from as Id<"practices"> } : "skip")
  const extractScope = useAction(api.practices.extractScope)
  const createPractice = useMutation(api.practices.create)
  const analyze = useAction(api.practices.analyze)

  const [chosenLane, setChosenLane] = useState<string | null>(null)
  // A ?from= prefill goes straight to the typed form — the words already
  // exist; re-speaking them helps no one.
  const [beat, setBeat] = useState<Beat>(() => ({ kind: from ? "type" : "tell" }))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [extractFailed, setExtractFailed] = useState(false)
  // Typed-form state and uploads live here, keyed per lane, so each lane's
  // fields, markers, and documents survive lane switches and mode toggles
  // until the page is left — and never appear in any other lane.
  const [forms, dispatchForms] = useReducer(laneFormsReducer, {})
  const tellScroll = useAutoHideScrollbar<HTMLDivElement>()
  const confirmScroll = useAutoHideScrollbar<HTMLDivElement>()

  const requested = lane && isPackId(lane) ? lane : undefined
  const pack = getPack(source?.packId ?? chosenLane ?? requested ?? user?.defaultLane)
  const uploads = useMaterialUploads(pack.id)
  const dispatchForm = useCallback(
    (action: IntakeFormAction) => dispatchForms({ lane: pack.id, action }),
    [pack.id]
  )

  // Seeds the ?from= prefill once its source query lands (external data
  // arrival); the reducer ignores a seed for a lane that already exists.
  useEffect(() => {
    if (source) dispatchForms({ lane: source.packId, action: { type: "seed", scope: source.scope } })
  }, [source])

  if (user === undefined) return null
  // A prefill source that's still loading would flash a blank form; one the
  // caller doesn't own resolves to null and falls through to a blank form.
  if (from && source === undefined) return null

  const lanes = (user?.lanes ?? []).filter(isPackId)
  const prefilled = source !== null && source !== undefined

  const handleLaneSwitch = (laneId: string) => {
    if (laneId === pack.id) return
    // Each lane's typed progress and uploads stay in its own record — the
    // switch only changes which record is visible. The chosen input mode is
    // the user's, not the lane's — typing stays typing. Mid-voice beats
    // (extracting, confirm) carry the old lane's spoken content, so they
    // land back on "tell".
    setChosenLane(laneId)
    setBeat((prev) => (prev.kind === "type" ? prev : { kind: "tell" }))
    setExtractFailed(false)
  }

  const handleTranscript = async (transcript: string, seconds: number) => {
    setBeat({ kind: "extracting" })
    setExtractFailed(false)
    try {
      const heard = await extractScope({ packId: pack.id, pitch: transcript, source: "voice" })
      setBeat({ kind: "confirm", heard, seconds })
    } catch {
      setExtractFailed(true)
      setBeat({ kind: "tell" })
    }
  }

  const handleSubmit = async (scope: Scope) => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const practiceId = await createPractice({
        packId: pack.id,
        scope,
        materials: uploads.readyMaterials,
      })
      analyze({ id: practiceId }).catch(() => {
        // The wait screen owns retries; a failed kick-off just means it
        // starts the read itself.
      })
      router.push(`/simulation/${practiceId}/analyze`)
    } catch {
      setSubmitError("That didn't go through. Check your connection and try again.")
      setSubmitting(false)
    }
  }

  return (
    <FlowShell stage="brief" packId={pack.id} fullBleed>
      <div className="flex h-full min-h-0 flex-col px-10 pt-7 max-md:px-5">
      {lanes.length > 1 && !prefilled && (
        <nav aria-label="Practice lane" className="mb-7 flex flex-none justify-center gap-2">
          {lanes.map((laneId) => (
            <button
              key={laneId}
              type="button"
              onClick={() => handleLaneSwitch(laneId)}
              aria-current={laneId === pack.id ? "page" : undefined}
              className={cn(
                "focus-ring flex items-center gap-[7px] rounded-full border px-4 py-[7px] text-[12.5px] font-medium transition-colors",
                laneId === pack.id
                  ? "border-accent-line bg-accent-bg text-accent-blue"
                  : "border-line-2 bg-surface-raised text-on-surface-2 hover:bg-surface-2"
              )}
            >
              <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-ink-4" />
              {getPack(laneId).shortLabel}
            </button>
          ))}
        </nav>
      )}

      {extractFailed && beat.kind === "tell" && (
        <p role="alert" className="mx-auto mb-6 max-w-[46ch] text-center text-[13.5px] text-red-fg">
          Shaping your brief hit an error. Try again, or type it instead.
        </p>
      )}

      {beat.kind === "tell" && (
        <div ref={tellScroll} className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pb-16 pt-6">
          <TellIt
            key={pack.id}
            pack={pack}
            onTranscript={handleTranscript}
            onTypeInstead={() => setBeat({ kind: "type" })}
            onAddDocuments={() => setBeat({ kind: "type" })}
          />
        </div>
      )}

      {beat.kind === "extracting" && (
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-blue" />
          <p role="status" className="text-[15px] font-medium">
            Shaping what you said into a brief
          </p>
          <p className="text-[13px] text-on-surface-3">Only what you actually said makes it in.</p>
        </div>
      )}

      {beat.kind === "type" && (
        <>
          <div className="flex-none text-center">
            <h1 className="text-[25px] font-semibold tracking-[-.02em]">
              {pack.copy.tellIt.heading}
            </h1>
            <button
              type="button"
              onClick={() => setBeat({ kind: "tell" })}
              className="focus-ring mb-6 mt-3 inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface-raised px-3.5 py-[6px] text-[12.5px] text-on-surface-3 transition-colors hover:bg-surface-2 hover:text-accent-blue"
            >
              <Mic className="size-[13px]" />
              Talk it instead. A minute is plenty
            </button>
          </div>
          <TypedForm
            pack={pack}
            form={forms[pack.id] ?? initialFormState()}
            dispatch={dispatchForm}
            uploads={uploads}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        </>
      )}

      {beat.kind === "confirm" && (
        <div ref={confirmScroll} className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pb-16">
          <ConfirmBrief
            key={pack.id}
            pack={pack}
            heard={beat.heard}
            seconds={beat.seconds}
            uploads={uploads}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            onBack={() => setBeat({ kind: "tell" })}
          />
        </div>
      )}
      </div>
    </FlowShell>
  )
}

export default NewPracticePage
