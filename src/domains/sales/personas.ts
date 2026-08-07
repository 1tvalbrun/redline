import type { Persona } from "../types.ts"

// The sales lane's buyer. One persona on purpose: a pitch is a 1-on-1, and
// the operator archetype covers the hardest room — the person who owns the
// process you're asking them to change. The Runway avatar id lives in the
// Convex avatars registry.
export const BUYER_PERSONAS: Persona[] = [
  {
    id: "buyer-01",
    archetypeId: "operator_buyer",
    name: "Cole Merritt",
    role: "Director of Operations, multi-site facilities group",
    shortRole: "The buyer",
    tone: "Warm but immovable, guards the team's time, has sat through a hundred vendor pitches",
    image: "/avatars/cole-merritt.png",
    attack: [
      { text: "Owns the process you want to change. Comes for " },
      { text: "switching cost and proof", strong: true },
      { text: ": what breaks, who pays, and what happens at month three." },
    ],
    bio: "Runs operations across sites and has survived a hundred vendor pitches. Likes ideas fine; buys outcomes, references, and a next step worth the calendar slot.",
    tags: ["Switching cost", "ROI proof", "Next steps"],
    axes: ["value", "fit", "objections", "close"],
  },
]
