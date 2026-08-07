// Pack-agnostic readiness machinery. Which axes exist, their labels, and
// which persona owns each one are pack data (src/domains); everything here
// takes the axis keys as input and never names one.

export type RiskScores = Partial<Record<string, number>>

export type Readiness = number & { readonly __brand: "Readiness" }

// The engine-wide readiness bar. What the line is *called* is pack copy
// (pack.targetLine.label: "Investor-ready", "Deal-ready"); the height is
// shared so scores stay comparable across lanes.
export const READY_LINE = 90

export type ReadinessSeverity = "bad" | "warn" | "ok"

export const readinessSeverity = (value: number): ReadinessSeverity =>
  value < 50 ? "bad" : value < 70 ? "warn" : "ok"

export type ReadinessSnapshot = {
  perAxis: Record<string, Readiness | null>
  overall: Readiness | null
  underFire: string | null
}

// Who delivers the spoken verdict: the panelist the user faced, or — when
// they faced several — the one who owns the weakest axis. ownerOf maps an
// axis key to the persona id that presses it (derived from the pack).
export const selectVerdictSpeaker = <T extends { id: string }>(
  axes: readonly string[],
  ownerOf: Record<string, string>,
  characters: T[],
  risk: RiskScores | undefined
): T | null => {
  if (characters.length <= 1) return characters[0] ?? null
  const weakest = deriveReadiness(axes, risk).underFire
  const owner = weakest
    ? characters.find((c) => c.id === ownerOf[weakest])
    : undefined
  return owner ?? characters[0]
}

const toReadiness = (value: number): Readiness =>
  Math.max(0, Math.min(100, Math.round(value))) as Readiness

// One live turn may move an axis's risk by at most maxDelta points, whatever
// the model proposes. Applied inside the room mutation so the bound holds
// against the committed score even when two turns land concurrently.
export const boundRiskDelta = (current: number, proposed: number, maxDelta = 10): number => {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  const diff = proposed - current
  if (Math.abs(diff) <= maxDelta) return clamp(proposed)
  return clamp(current + Math.sign(diff) * maxDelta)
}

// Risk arrives 0-100 per axis from the orchestrator (server-clamped).
// Axes with no finite score yet are pending (null) — consumers render a
// "no data yet" state instead of a number. Never NaN.
export const deriveReadiness = (
  axes: readonly string[],
  risk: RiskScores | undefined,
  previousRisk?: RiskScores
): ReadinessSnapshot => {
  const perAxis = Object.fromEntries(
    axes.map((axis) => {
      const value = risk?.[axis]
      const readiness =
        typeof value === "number" && Number.isFinite(value)
          ? toReadiness(100 - value)
          : null
      return [axis, readiness]
    })
  ) as Record<string, Readiness | null>

  const scored = axes.flatMap((axis) => {
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
