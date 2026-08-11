import { founderPack } from "./founder/pack.ts"
import { salesPack } from "./sales/pack.ts"
import { auditPack } from "./audit/pack.ts"
import type { DomainPack, VerdictOption, VerdictTone } from "./types.ts"

// The one list of lanes. Onboarding renders it, users.lanes validates
// against it, and every engine read resolves a pack through it.
export const PACKS: Record<string, DomainPack> = {
  [founderPack.id]: founderPack,
  [salesPack.id]: salesPack,
  [auditPack.id]: auditPack,
}

export const ALL_PACKS = Object.values(PACKS)

export const isPackId = (id: string): boolean => id in PACKS

export const getPack = (packId?: string): DomainPack =>
  (packId !== undefined ? PACKS[packId] : undefined) ?? founderPack

// Cross-lane verdict lookup for surfaces that mix practices from several
// packs (badges, session lists). Values are distinct across packs by
// convention; first match wins.
export const findVerdict = (value: string): VerdictOption | null => {
  for (const pack of ALL_PACKS) {
    const option = pack.verdicts.options.find((o) => o.value === value)
    if (option) return option
  }
  return null
}

// "Up from last time" without numbers: tones order bad < mid < good.
const TONE_RANK: Record<VerdictTone, number> = { bad: 0, mid: 1, good: 2 }

export const verdictDirection = (
  previous: string | null,
  next: string
): "up" | "down" | "same" | null => {
  if (previous === null) return null
  const prevTone = findVerdict(previous)?.tone
  const nextTone = findVerdict(next)?.tone
  if (!prevTone || !nextTone) return null
  const delta = TONE_RANK[nextTone] - TONE_RANK[prevTone]
  return delta > 0 ? "up" : delta < 0 ? "down" : "same"
}
