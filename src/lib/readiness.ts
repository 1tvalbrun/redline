export const AXES = ["market", "customer", "technical", "gtm"] as const

export type Axis = (typeof AXES)[number]

export type RiskScores = Partial<Record<Axis, number>>

export type Readiness = number & { readonly __brand: "Readiness" }

export type ReadinessSnapshot = {
  perAxis: Record<Axis, Readiness>
  overall: Readiness
  underFire: Axis
}

// The orchestrator scores risk 0-100 per axis and assumes 50 for axes it
// hasn't scored yet — mirror that baseline so pre-first-turn state agrees.
const BASELINE_RISK = 50

const toReadiness = (value: number): Readiness =>
  Math.max(0, Math.min(100, Math.round(value))) as Readiness

export const deriveReadiness = (
  risk: RiskScores,
  previousRisk?: RiskScores
): ReadinessSnapshot => {
  const perAxis = Object.fromEntries(
    AXES.map((axis) => [axis, toReadiness(100 - (risk[axis] ?? BASELINE_RISK))])
  ) as Record<Axis, Readiness>

  const overall = toReadiness(
    AXES.reduce((sum, axis) => sum + perAxis[axis], 0) / AXES.length
  )

  const lowest = Math.min(...AXES.map((axis) => perAxis[axis]))
  const contenders = AXES.filter((axis) => perAxis[axis] === lowest)
  const changed = previousRisk
    ? contenders.filter((axis) => risk[axis] !== previousRisk[axis])
    : []
  const underFire = changed[0] ?? contenders[0]

  return { perAxis, overall, underFire }
}
