"use client"

import { useEffect } from "react"
import { useLocalMedia } from "@runwayml/avatars-react"

type MicBridgeProps = {
  onStateChange: (enabled: boolean) => void
  toggleRef: { current: (() => void) | null }
}

export const MicBridge = ({ onStateChange, toggleRef }: MicBridgeProps) => {
  const { isMicEnabled, toggleMic } = useLocalMedia()

  useEffect(() => {
    onStateChange(isMicEnabled)
  }, [isMicEnabled, onStateChange])

  useEffect(() => {
    toggleRef.current = toggleMic
    return () => {
      toggleRef.current = null
    }
  }, [toggleMic, toggleRef])

  return null
}
