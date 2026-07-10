"use client"

import { useEffect } from "react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { startFounderTranscription } from "@/lib/founderTranscription"

type UserSpeechBridgeProps = {
  roomId: Id<"rooms">
  enabled: boolean
}

// Streams the founder's speech through the shared transcription core and
// writes each final turn to the room transcript. Interims are discarded:
// the room shows no live interim for either side — the founder's finals are
// display-delayed to the avatar's cadence (see RoomShell), and a live
// interim would undercut that symmetry. The avatar's own speech is
// transcribed by Runway (TranscriptBridge) — this bridge is founder-only.
export const UserSpeechBridge = ({ roomId, enabled }: UserSpeechBridgeProps) => {
  const addTranscriptEntry = useMutation(api.rooms.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)

  useEffect(() => {
    if (!enabled) return

    const writeFinalTurn = async (text: string, spokenAt: number | null) => {
      try {
        const result = await addTranscriptEntry({
          id: roomId,
          entry: {
            speaker: "user",
            speakerName: "You",
            text,
            timestamp: Date.now(),
            // Measured speech onset when word timing was available; readers
            // fall back to timestamp when absent.
            ...(spokenAt !== null && { spokenAt }),
            type: "user",
          },
        })
        if (result?.written) {
          decide({ roomId }).catch((err) =>
            console.error("orchestrator.decide failed:", err)
          )
        }
      } catch (err) {
        console.warn("[UserSpeechBridge] transcript write failed:", err)
      }
    }

    const stream = startFounderTranscription({
      // Finals keep flowing through the stop-flush so in-flight speech is
      // written even when the mic goes off or the room concludes.
      onFinalTurn: (text, spokenAt) => void writeFinalTurn(text, spokenAt),
      onInterim: () => {},
      onStatus: (status) => {
        if (status === "denied" || status === "error") {
          console.warn("[UserSpeechBridge] transcription unavailable:", status)
        }
      },
    })

    return () => {
      // Graceful stop (not dispose): capture is released immediately (mic
      // indicator clears), while the socket flush still commits speech that
      // was in flight.
      void stream.stop()
    }
  }, [roomId, enabled, addTranscriptEntry, decide])

  return null
}
