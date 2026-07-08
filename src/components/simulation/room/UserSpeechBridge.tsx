"use client"

import { useEffect } from "react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type UserSpeechBridgeProps = {
  roomId: Id<"rooms">
  enabled: boolean
}

const CHUNK_MS = 6000
const MIN_TRANSCRIPT_LENGTH = 4

export const UserSpeechBridge = ({ roomId, enabled }: UserSpeechBridgeProps) => {
  const addTranscriptEntry = useMutation(api.rooms.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)

  useEffect(() => {
    if (!enabled) {
      console.log("[UserSpeechBridge] disabled (mic off)")
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let activeRecorder: MediaRecorder | null = null
    let chunkTimer: ReturnType<typeof setTimeout> | null = null

    const processBlob = async (blob: Blob) => {
      try {
        const form = new FormData()
        form.append("audio", blob, "chunk.webm")
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        })
        if (!res.ok) {
          console.warn("[UserSpeechBridge] /api/transcribe", res.status)
          return
        }
        const data = (await res.json()) as { text?: string }
        const text = (data.text ?? "").trim()
        if (text.length < MIN_TRANSCRIPT_LENGTH) return

        console.log("[UserSpeechBridge] transcribed:", text)
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
        console.warn("[UserSpeechBridge] transcribe error:", err)
      }
    }

    const recordChunk = () => {
      if (cancelled || !stream) return
      const chunks: Blob[] = []
      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(stream, { mimeType: "audio/webm" })
      } catch (err) {
        console.warn("[UserSpeechBridge] MediaRecorder unsupported:", err)
        return
      }
      activeRecorder = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      rec.onstop = () => {
        if (chunks.length > 0 && !cancelled) {
          const blob = new Blob(chunks, { type: "audio/webm" })
          void processBlob(blob)
        }
        if (!cancelled) recordChunk()
      }
      rec.start()
      chunkTimer = setTimeout(() => {
        try {
          rec.stop()
        } catch {}
      }, CHUNK_MS)
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        console.log("[UserSpeechBridge] mic acquired, streaming 6s chunks to AssemblyAI")
        recordChunk()
      })
      .catch((err) => {
        console.warn("[UserSpeechBridge] mic access failed:", err)
      })

    return () => {
      cancelled = true
      if (chunkTimer) clearTimeout(chunkTimer)
      try {
        activeRecorder?.stop()
      } catch {}
      stream?.getTracks().forEach((t) => t.stop())
      console.log("[UserSpeechBridge] stopped")
    }
  }, [roomId, enabled, addTranscriptEntry, decide])

  return null
}
