export type SpeakerStatus = 'listening' | 'speaking' | 'evaluating' | 'idle'

export type CharacterArchetype = 'vc' | 'target_customer' | 'technical_architect'

export type Character = {
  id: string
  archetypeId: CharacterArchetype
  name: string
  role: string
  avatarId: string
  tone: string
  systemPrompt: string
  status: SpeakerStatus
}

export type TranscriptEntry = {
  speaker: string
  speakerName: string
  text: string
  timestamp: number
  type: string
}

export type RiskScores = {
  market?: number
  customer?: number
  technical?: number
  gtm?: number
}

export type Round = 'overview' | 'challenge' | 'cross' | 'verdict'

export type RoomStatus = 'pending' | 'live' | 'concluded'
