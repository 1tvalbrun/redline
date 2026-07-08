"use client"

import { useEffect, useRef } from "react"
import { useLocalMedia, useTranscription } from "@runwayml/avatars-react"

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
  // speaking signal: interim avatar segments mean speech is in progress;
  // a final segment (or silence) decays the indicator.
  useTranscription((entry) => {
    if (entry.participantIdentity.startsWith("user:")) return
    onSpeakingChange(true)
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
    silenceTimer.current = setTimeout(
      () => onSpeakingChange(false),
      entry.final ? 800 : 2500
    )
  })

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current)
    }
  }, [])

  return null
}
