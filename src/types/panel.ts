export type TranscriptEntry = {
  speaker: string
  speakerName: string
  text: string
  timestamp: number
  // Measured speech onset (wall-clock ms); absent on legacy rows, which
  // fall back to timestamp for ordering.
  spokenAt?: number
  type: "user" | "panelist"
}
