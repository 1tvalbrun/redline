import { founderPack } from "./founder/pack.ts"
import { salesPack } from "./sales/pack.ts"
import type { Brief, DomainPack, Scope, VerdictOption } from "./types.ts"

// The one list of lanes. Onboarding renders it, users.lanes validates
// against it, and every engine read resolves a pack through it.
export const PACKS: Record<string, DomainPack> = {
  [founderPack.id]: founderPack,
  [salesPack.id]: salesPack,
}

export const ALL_PACKS = Object.values(PACKS)

export const isPackId = (id: string): boolean => id in PACKS

// Resolver for stored data: legacy rows have no packId and read as founder.
export const getPack = (packId?: string): DomainPack =>
  (packId !== undefined ? PACKS[packId] : undefined) ?? founderPack

// The engagement scope, whichever shape the row stores. Legacy rows carry
// the founder-shaped brief (pre-M3, founder by definition); its keys map
// 1:1 onto the founder pack's scope keys.
export const scopeOf = (simulation: { scope?: Scope; brief?: Brief }): Scope => {
  if (simulation.scope) return simulation.scope
  if (!simulation.brief) return {}
  const { whyNow, ...rest } = simulation.brief
  return { ...rest, ...(whyNow !== undefined ? { whyNow } : {}) }
}

export const axisKeys = (pack: DomainPack): string[] => pack.axes.map((axis) => axis.key)

export const axisLabel = (pack: DomainPack, key: string): string =>
  pack.axes.find((axis) => axis.key === key)?.label ?? key

// Cross-lane verdict lookup for surfaces that mix engagements from several
// packs (badges, list filters). Values are distinct across packs by
// convention; first match wins.
export const findVerdict = (value: string): VerdictOption | null => {
  for (const pack of ALL_PACKS) {
    const option = pack.verdicts.options.find((o) => o.value === value)
    if (option) return option
  }
  return null
}

// axis key → persona id that presses it hardest (first persona claiming the
// axis wins). Feeds the panel recommendation and verdict-speaker selection.
export const axisOwners = (pack: DomainPack): Record<string, string> => {
  const owners: Record<string, string> = {}
  for (const persona of pack.personas) {
    for (const axis of persona.axes) {
      owners[axis] ??= persona.id
    }
  }
  return owners
}
