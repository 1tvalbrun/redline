"use client"

import { useEffect, useRef } from "react"
import { useAvatarStatus, useLocalMedia, useTranscription } from "@runwayml/avatars-react"
import { isAvatarSpeech } from "@/lib/transcript"

// The avatar session's connection phases, surfaced so the room can detect
// a session that never produces an avatar (status stuck before "ready").
export type AvatarStatus =
  | "connecting"
  | "waiting"
  | "ready"
  | "ending"
  | "ended"
  | "error"

type SessionStatusBridgeProps = {
  onSpeakingChange: (speaking: boolean) => void
  onMicError: (error: Error | null) => void
  onAvatarStatus: (status: AvatarStatus) => void
}

export const SessionStatusBridge = ({
  onSpeakingChange,
  onMicError,
  onAvatarStatus,
}: SessionStatusBridgeProps) => {
  const { micError } = useLocalMedia()
  const { status } = useAvatarStatus()
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onMicError(micError)
  }, [micError, onMicError])

  useEffect(() => {
    onAvatarStatus(status)
  }, [status, onAvatarStatus])

  // The SDK exposes no audio-level API, so streaming transcription is the
  // speaking signal. A turn's first interim arrives at speech onset (its
  // final only lands when her next turn starts), so interims flip the
  // indicator on immediately; a final (or interim silence) decays it.
  useTranscription(
    (entry) => {
      if (!isAvatarSpeech(entry)) return
      onSpeakingChange(true)
      if (silenceTimer.current) clearTimeout(silenceTimer.current)
      silenceTimer.current = setTimeout(
        () => onSpeakingChange(false),
        entry.final ? 800 : 2500
      )
    },
    { interim: true }
  )

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current)
    }
  }, [])

  return null
}
