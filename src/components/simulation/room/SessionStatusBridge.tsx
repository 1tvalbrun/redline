"use client"

import { useEffect, useRef } from "react"
import { useLocalMedia, useTranscription } from "@runwayml/avatars-react"
import { isAvatarSpeech } from "@/lib/transcript"

type SessionStatusBridgeProps = {
  onSpeakingChange: (speaking: boolean) => void
  onMicError: (error: Error | null) => void
}

export const SessionStatusBridge = ({
  onSpeakingChange,
  onMicError,
}: SessionStatusBridgeProps) => {
  const { micError } = useLocalMedia()
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onMicError(micError)
  }, [micError, onMicError])

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
