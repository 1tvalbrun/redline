"use client"

import { useTranscription } from "@runwayml/avatars-react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type TranscriptBridgeProps = {
  roomId: Id<"rooms">
  character: { id: string; name: string }
}

export const TranscriptBridge = ({ roomId, character }: TranscriptBridgeProps) => {
  const addTranscriptEntry = useMutation(api.rooms.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)

  useTranscription((entry) => {
    if (!entry.final) return
    if (entry.participantIdentity.startsWith("user:")) return
    // The engine also replays the FOUNDER's turns over the data channel
    // (id `runway-transcription-user-<n>`), stamped with the avatar's
    // identity and delayed until the next founder turn — without this they
    // land as duplicated panelist entries. The avatar's own speech arrives
    // via LiveKit native transcription and is untouched.
    if (entry.id.startsWith("runway-transcription-user-")) return
    void (async () => {
      const result = await addTranscriptEntry({
        id: roomId,
        entry: {
          speaker: character.id,
          speakerName: character.name,
          text: entry.text,
          timestamp: Date.now(),
          type: "panelist",
        },
      })
      if (result?.written) {
        decide({ roomId }).catch((err) =>
          console.error("orchestrator.decide failed:", err)
        )
      }
    })()
  })

  return null
}
