"use client"

import { RoomHeader } from "./RoomHeader"
import { AvatarPanelGrid } from "./AvatarPanelGrid"
import { UserTile } from "./UserTile"
import { PromptHelpers } from "./PromptHelpers"
import { TranscriptPanel } from "./TranscriptPanel"
import { RiskMeter } from "./RiskMeter"
import { LiveNotes } from "./LiveNotes"

const NOW = Date.now()

const MOCK_CHARACTERS = [
  {
    id: "vc-01",
    archetypeId: "vc",
    name: "Victoria Chen",
    role: "Partner, Series A/B",
    status: "listening",
  },
  {
    id: "tc-01",
    archetypeId: "target_customer",
    name: "Marcus Rivera",
    role: "Head of Strategy",
    status: "evaluating",
  },
  {
    id: "ta-01",
    archetypeId: "technical_architect",
    name: "Dr. Sarah Okafor",
    role: "Principal Engineer",
    status: "challenging",
  },
]

const MOCK_TRANSCRIPT = [
  { speaker: "vc-01", speakerName: "Victoria Chen", text: "Walk me through defensibility. What stops Crayon from shipping a forecast tab next quarter?", timestamp: NOW - 30000, type: "character" },
  { speaker: "user", speakerName: "Mara Chen", text: "Crayon is built for bottlenecks — present-tense intel. We're betting the buyer wants forward-looking, and that's a different ML stack and a different team.", timestamp: NOW - 25000, type: "user" },
  { speaker: "ta-01", speakerName: "Dr. Sarah Okafor", text: "I already have Crayon and a functional analyst. Why do I add a fourth tool and a fourth login?", timestamp: NOW - 20000, type: "character" },
  { speaker: "user", speakerName: "Mara Chen", text: "We replace the analyst lever, not the bottleneck. The pitch is ROI on one headcount, not 'another tab.'", timestamp: NOW - 15000, type: "user" },
]

const MOCK_RISK_SCORES = { market: 75, customer: 78, technical: 37, gtm: 65 }

const MOCK_NOTES = [
  { type: "follow_up", text: "Need vertical proof — 1 design partner in each of 3 verticals", timestamp: NOW - 20000 },
  { type: "event", text: "Competitor scenario injected. Panel pivots.", timestamp: NOW - 15000 },
  { type: "weak_assumption", text: "BYE hosting as 'replace headcount' leads to pushback on wedge.", timestamp: NOW - 10000 },
]

type RoomShellProps = {
  simulationId: string
}

export const RoomShell = ({ simulationId }: RoomShellProps) => {
  const handleEndSession = () => {}
  const handlePromptSelect = (_prompt: string) => {}

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <RoomHeader
        simulationName="CARETHINK"
        round="CHALLENGE"
        elapsedTime="00:34"
        onEndSession={handleEndSession}
      />
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <AvatarPanelGrid
          characters={MOCK_CHARACTERS}
          activeCharacterId="ta-01"
        />
        <div className="flex flex-1 gap-3 min-h-0">
          <div className="flex w-[180px] shrink-0 flex-col gap-3">
            <UserTile userName="Mara Chen" simulationName="CARETHINK" />
            <PromptHelpers onSelect={handlePromptSelect} />
          </div>
          <div className="flex-1 min-w-0">
            <TranscriptPanel
              transcript={MOCK_TRANSCRIPT}
              characters={MOCK_CHARACTERS}
            />
          </div>
          <div className="flex w-[280px] shrink-0 flex-col gap-3">
            <RiskMeter scores={MOCK_RISK_SCORES} />
            <LiveNotes notes={MOCK_NOTES} />
          </div>
        </div>
      </div>
    </div>
  )
}
