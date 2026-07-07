export const AXES = ["market", "customer", "technical", "gtm"] as const

export type Axis = (typeof AXES)[number]

export type RiskScores = Partial<Record<Axis, number>>

export type Readiness = number & { readonly __brand: "Readiness" }

export type ReadinessSnapshot = {
  perAxis: Record<Axis, Readiness | null>
  overall: Readiness | null
  underFire: Axis | null
}

export const AXIS_LABELS: Record<Axis, string> = {
  market: "Market",
  customer: "Customer",
  technical: "Technical",
  gtm: "Go-to-market",
}

const toReadiness = (value: number): Readiness =>
  Math.max(0, Math.min(100, Math.round(value))) as Readiness

// Risk arrives 0-100 per axis from the orchestrator (server-clamped).
// Axes with no finite score yet are pending (null) — consumers render a
// "no data yet" state instead of a number. Never NaN.
export const deriveReadiness = (
  risk: RiskScores | undefined,
  previousRisk?: RiskScores
): ReadinessSnapshot => {
  const perAxis = Object.fromEntries(
    AXES.map((axis) => {
      const value = risk?.[axis]
      const readiness =
        typeof value === "number" && Number.isFinite(value)
          ? toReadiness(100 - value)
          : null
      return [axis, readiness]
    })
  ) as Record<Axis, Readiness | null>

  const scored = AXES.flatMap((axis) => {
    const readiness = perAxis[axis]
    return readiness === null ? [] : [{ axis, readiness }]
  })
  if (scored.length === 0) return { perAxis, overall: null, underFire: null }

  const overall = toReadiness(
    scored.reduce((sum, s) => sum + s.readiness, 0) / scored.length
  )

  const lowest = Math.min(...scored.map((s) => s.readiness))
  const contenders = scored.filter((s) => s.readiness === lowest).map((s) => s.axis)
  const changed = previousRisk
    ? contenders.filter((axis) => risk?.[axis] !== previousRisk[axis])
    : []
  const underFire = changed[0] ?? contenders[0]

  return { perAxis, overall, underFire }
}
