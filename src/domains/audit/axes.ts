import type { ScoreAxis } from "../types.ts"

// The audit lane's four readiness axes, drawn from how assessments actually
// test: documents are examined, records are requested, people are
// interviewed, and operations are checked for regularity. "Cadence" exists
// because nearly every safeguard carries a frequency — weekly backups,
// quarterly validations, annual reviews — and "we did it once" is the
// classic finding.
export const AUDIT_AXES: ScoreAxis[] = [
  { key: "process", label: "Process" },
  { key: "evidence", label: "Evidence" },
  { key: "command", label: "Command" },
  { key: "cadence", label: "Cadence" },
]

export const AUDIT_AXIS_KEYS = AUDIT_AXES.map((axis) => axis.key)
