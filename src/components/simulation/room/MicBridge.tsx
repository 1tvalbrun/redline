"use client"

import { useEffect, useRef } from "react"
import { useLocalMedia } from "@runwayml/avatars-react"

type MicBridgeProps = {
  onStateChange: (enabled: boolean) => void
  toggleRef: { current: (() => void) | null }
}

export const MicBridge = ({ onStateChange, toggleRef }: MicBridgeProps) => {
  const { isMicEnabled, toggleMic } = useLocalMedia()

  // The SDK reads false between credentials-ready and the mic track
  // publishing, so mirroring it raw flashes the "muted" banner on every
  // connect. Swallow readings until the mic has been live once; after
  // that, false is a real mute. The bridge remounts per connect attempt
  // (AvatarProvider key={connectAttempt}), which resets the latch.
  const hasBeenLive = useRef(false)
  useEffect(() => {
    if (isMicEnabled) hasBeenLive.current = true
    if (!hasBeenLive.current) return
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
