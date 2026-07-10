"use client"

import { useEffect, useRef } from "react"
import { useAvatarSession, useTranscription } from "@runwayml/avatars-react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { isAvatarSpeech } from "@/lib/transcript"

type TranscriptBridgeProps = {
  roomId: Id<"rooms">
  character: { id: string; name: string }
}

// Writes each avatar turn to the room transcript. Entries arrive as Runway's
// flat deltas over the data channel with no timing fields, and a turn's
// final lands only when her next turn starts — so speech onset is stamped
// from the turn's FIRST interim (which arrives at turn onset), and the final
// is written with that spokenAt. Interims exist for timing only; they are
// never written to Convex or sent to the orchestrator.
export const TranscriptBridge = ({ roomId, character }: TranscriptBridgeProps) => {
  const addTranscriptEntry = useMutation(api.rooms.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)
  const session = useAvatarSession()

  // First-seen wall-clock per turn id; a turn's entry is deleted when its
  // final is written, so the map only ever holds in-progress turns.
  const firstSeenAt = useRef(new Map<string, number>())

  useTranscription(
    (entry) => {
      if (!isAvatarSpeech(entry)) return
      if (!entry.final) {
        if (!firstSeenAt.current.has(entry.id)) {
          firstSeenAt.current.set(entry.id, Date.now())
        }
        return
      }
      // A final with no recorded interim (shouldn't happen, but the channel
      // is external) falls back to write time.
      const spokenAt = firstSeenAt.current.get(entry.id) ?? Date.now()
      firstSeenAt.current.delete(entry.id)
      void (async () => {
        const result = await addTranscriptEntry({
          id: roomId,
          entry: {
            speaker: character.id,
            speakerName: character.name,
            text: entry.text,
            timestamp: Date.now(),
            spokenAt,
            type: "panelist",
          },
        })
        if (result?.written) {
          decide({ roomId }).catch((err) =>
            console.error("orchestrator.decide failed:", err)
          )
        }
      })()
    },
    { interim: true }
  )

  // The avatar session can end while the room stays live (observed: GWM
  // sessions end themselves); stale first-seen times must not leak into a
  // reconnected session's turns.
  useEffect(() => {
    if (session.state !== "ended" && session.state !== "error") return
    firstSeenAt.current.clear()
  }, [session.state])

  return null
}
