import { PANEL_PERSONAS } from "@/domains/founder/personas"

// Client-side roster: the shared personas plus their UI-only images. The
// Runway avatar id for a persona lives in the Convex avatars registry and is
// resolved server-side by rooms.create; the client never handles it.
const IMAGES: Record<string, string> = {
  "vc-01": "/avatars/victoria-chen.png",
  "tc-01": "/avatars/marcus-rivera.png",
  "ta-01": "/avatars/sarah-okafor.png",
}

export const DEFAULT_CHARACTERS = PANEL_PERSONAS.map((persona) => ({
  ...persona,
  image: IMAGES[persona.id] ?? "",
}))
