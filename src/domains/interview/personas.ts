import type { Persona } from "../types.ts"

// The interview lane's cast of three, specialized by interview format, not
// domain — formats are few and stable; domains are infinite. The spoken
// personalities live on the Runway Characters (domain-blind, with a
// permanent honest-scoping backstop); these fields feed persona cards and
// the debrief prompts. Runway avatar ids live in the Convex avatars
// registry (npx convex run avatars:register — see the spec).
export const INTERVIEWER_PERSONAS: Persona[] = [
  {
    id: "screener-01",
    archetypeId: "recruiter_screen",
    name: "Jun Park",
    role: "Recruiter, first-round screen",
    shortRole: "The screener",
    tone: "Fast, warm, efficient; listens for motivation, a coherent career story, and the fit questions a resume can't answer",
    image: "/avatars/jun-park.png",
    attack: [
      { text: "Runs the thirty-minute screen. Comes for " },
      { text: "your story and your why", strong: true },
      { text: ": what you did, why you're leaving, and whether it holds together at pace." },
    ],
    bio: "Screens hundreds of candidates a year and decides in minutes who moves forward. Friendly on the surface, ruthless about vagueness — a rambling answer is its own red flag.",
    tags: ["Motivation", "Career story", "Fit"],
    signature:
      "Walk me through the last few years in about a minute — and what you're looking for next.",
  },
  {
    id: "hm-01",
    archetypeId: "hiring_manager",
    name: "Renee Calloway",
    role: "Hiring manager, behavioral loop",
    shortRole: "The hiring manager",
    tone: "Steady and probing, goes three levels deep on every story; allergic to a 'we' that hides what you actually did",
    image: "/avatars/renee-calloway.png",
    attack: [
      { text: "Owns the team you'd join. Comes for " },
      { text: "ownership and conflict", strong: true },
      { text: ": real stories, your actual role in them, and what you'd do differently." },
    ],
    bio: "Has hired and managed through enough cycles to know rehearsed answers on sight. Asks for one story, then follows it down until the real decisions and the real mistakes show.",
    tags: ["Ownership", "Conflict", "Behavioral depth"],
    signature: "Tell me about a time this went wrong — and what you did about it.",
  },
  {
    id: "practitioner-01",
    archetypeId: "domain_practitioner",
    name: "Tomás Reyes",
    role: "Senior practitioner, domain deep-dive",
    shortRole: "The practitioner",
    tone: "Knowledgeable and scenario-driven; presses why-chains and trade-offs until the reasoning either holds or runs out",
    image: "/avatars/tomas-reyes.png",
    attack: [
      { text: "Does the job you're interviewing for. Comes for " },
      { text: "scenarios and trade-offs", strong: true },
      { text: ": concrete situations, your reasoning under pressure, and the why behind each call." },
    ],
    bio: "The panelist who's done the work. Doesn't quiz on trivia — puts you in a situation from the role and keeps asking why until it's clear whether you've actually been there.",
    tags: ["Technical depth", "Trade-offs", "Scenarios"],
    signature: "Let's get concrete. Walk me through exactly how you'd handle this one.",
  },
]
