export const AXES = ["market", "customer", "technical", "gtm"] as const

export type Axis = (typeof AXES)[number]

export type RiskScores = Partial<Record<Axis, number>>

export type Readiness = number & { readonly __brand: "Readiness" }

export const INVESTOR_READY_LINE = 90

export type ReadinessSeverity = "bad" | "warn" | "ok"

export const readinessSeverity = (value: number): ReadinessSeverity =>
  value < 50 ? "bad" : value < 70 ? "warn" : "ok"

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

// Which interrogator presses hardest on each axis. The buyer owns both
// customer pain and how organizations actually buy (gtm). Shared by the
// Panel recommendation and verdict-speaker selection — one definition.
export const AXIS_TO_CHARACTER: Record<Axis, string> = {
  market: "vc-01",
  customer: "tc-01",
  gtm: "tc-01",
  technical: "ta-01",
}

// Who delivers the spoken verdict: the panelist the founder faced, or —
// when they faced several — the one who owns the weakest axis.
export const selectVerdictSpeaker = <T extends { id: string }>(
  characters: T[],
  risk: RiskScores | undefined
): T | null => {
  if (characters.length <= 1) return characters[0] ?? null
  const weakest = deriveReadiness(risk).underFire
  const owner = weakest
    ? characters.find((c) => c.id === AXIS_TO_CHARACTER[weakest])
    : undefined
  return owner ?? characters[0]
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
