"use client"

import { useEffect, useRef } from "react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { startFounderTranscription } from "@/lib/founderTranscription"

type UserSpeechBridgeProps = {
  roomId: Id<"rooms">
  enabled: boolean
  // In-progress (uncommitted) speech for display only — never written to
  // Convex, never sent to the orchestrator.
  onInterim: (text: string) => void
}

// Streams the founder's speech through the shared transcription core and
// writes each final turn to the room transcript. The avatar's own speech is
// transcribed by Runway (TranscriptBridge) — this bridge is founder-only.
export const UserSpeechBridge = ({ roomId, enabled, onInterim }: UserSpeechBridgeProps) => {
  const addTranscriptEntry = useMutation(api.rooms.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)

  const onInterimRef = useRef(onInterim)
  useEffect(() => {
    onInterimRef.current = onInterim
  }, [onInterim])

  useEffect(() => {
    if (!enabled) return
    let stopped = false

    const writeFinalTurn = async (text: string) => {
      try {
        const result = await addTranscriptEntry({
          id: roomId,
          entry: {
            speaker: "user",
            speakerName: "You",
            text,
            timestamp: Date.now(),
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
      // written; interims stop at unmount so no ghost line lingers.
      onFinalTurn: (text) => void writeFinalTurn(text),
      onInterim: (text) => {
        if (!stopped) onInterimRef.current(text)
      },
      onStatus: (status) => {
        if (status === "denied" || status === "error") {
          console.warn("[UserSpeechBridge] transcription unavailable:", status)
        }
      },
    })

    return () => {
      stopped = true
      onInterimRef.current("")
      // Graceful stop (not dispose): speech in flight when the mic goes off
      // or the room concludes still flushes into the transcript.
      void stream.stop()
    }
  }, [roomId, enabled, addTranscriptEntry, decide])

  return null
}
