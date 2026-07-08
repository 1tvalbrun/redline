import type { AuditResult } from "./audit.ts"
import { AXES, type Axis, type RiskScores } from "./readiness.ts"

const BASELINE_RISK = 50
const CLAIM_RELIEF = 6
const BLOCKER_WEIGHT = 15
const GAP_WEIGHT = 8

// Pre-run scores stay inside 5–95: an audit of documents alone can neither
// clear an idea nor condemn it the way a live session can.
const MIN_RISK = 5
const MAX_RISK = 95

// Derives per-axis risk (0–100, higher is worse) from the grounded audit:
// cited claims relieve risk on their axis, gaps add it by severity. Entries
// without an axis tag (legacy audits) carry no signal. Entirely separate
// from the live in-room scoring in orchestrator.decide.
export const deriveAuditRiskScores = (
  audit: Pick<AuditResult, "claims" | "gaps">
): Required<RiskScores> => {
  const risk = {} as Record<Axis, number>
  for (const axis of AXES) {
    const claimCount = audit.claims.filter((claim) => claim.axis === axis).length
    const gapLoad = audit.gaps
      .filter((gap) => gap.axis === axis)
      .reduce((sum, gap) => sum + (gap.severity === "blocker" ? BLOCKER_WEIGHT : GAP_WEIGHT), 0)
    const raw = BASELINE_RISK - claimCount * CLAIM_RELIEF + gapLoad
    risk[axis] = Math.round(Math.min(MAX_RISK, Math.max(MIN_RISK, raw)))
  }
  return risk
}
