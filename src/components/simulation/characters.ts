import { PANEL_PERSONAS } from "@/lib/personas"

// Client-side additions to the shared roster: Runway avatar ids are
// NEXT_PUBLIC_* so Next can inline them at build, and images are UI-only.
// The avatar's spoken personality lives on the Runway Character (dev
// portal), not in this repo.
const AVATAR_IDS: Record<string, string | undefined> = {
  "vc-01": process.env.NEXT_PUBLIC_RUNWAY_AVATAR_VC,
  "tc-01": process.env.NEXT_PUBLIC_RUNWAY_AVATAR_CUSTOMER,
  "ta-01": process.env.NEXT_PUBLIC_RUNWAY_AVATAR_TECH,
}

const IMAGES: Record<string, string> = {
  "vc-01": "/avatars/victoria-chen.png",
  "tc-01": "/avatars/marcus-rivera.png",
  "ta-01": "/avatars/sarah-okafor.png",
}

export const DEFAULT_CHARACTERS = PANEL_PERSONAS.map((persona) => ({
  ...persona,
  avatarId: AVATAR_IDS[persona.id] ?? "",
  image: IMAGES[persona.id] ?? "",
}))
