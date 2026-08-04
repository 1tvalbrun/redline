import { founderPack } from "./founder/pack.ts"
import type { DomainPack } from "./types.ts"

// The one list of lanes. Onboarding renders it, users.lanes validates
// against it, and every engine read resolves a pack through it.
export const PACKS: Record<string, DomainPack> = {
  [founderPack.id]: founderPack,
}

export const ALL_PACKS = Object.values(PACKS)

export const isPackId = (id: string): boolean => id in PACKS

// Resolver for stored data: legacy rows have no packId and read as founder.
export const getPack = (packId?: string): DomainPack =>
  (packId !== undefined ? PACKS[packId] : undefined) ?? founderPack
