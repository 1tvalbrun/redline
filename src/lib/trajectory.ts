export type RunScore = { at: number; score: number | null }

export type TrajectoryPoint = { at: number; score: number }

// Runs → chronological readiness points. Runs without a scored report yet
// (score null/non-finite) are excluded rather than plotted as gaps.
export const deriveTrajectory = (runs: RunScore[]): TrajectoryPoint[] =>
  runs
    .filter((run): run is TrajectoryPoint => Number.isFinite(run.score))
    .sort((a, b) => a.at - b.at)
