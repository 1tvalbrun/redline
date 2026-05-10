export const ARCHETYPE_CONFIG: Record<string, {
  label: string
  initials: string
  ring: string
  bg: string
  text: string
  border: string
  dot: string
}> = {
  vc: {
    label: "THE VC",
    initials: "VC",
    ring: "ring-blue-500",
    bg: "bg-blue-500",
    text: "text-blue-500",
    border: "border-blue-500",
    dot: "bg-blue-500",
  },
  target_customer: {
    label: "THE TARGET CUSTOMER",
    initials: "TC",
    ring: "ring-amber-500",
    bg: "bg-amber-500",
    text: "text-amber-500",
    border: "border-amber-500",
    dot: "bg-amber-500",
  },
  technical_architect: {
    label: "THE TECHNICAL ARCHITECT",
    initials: "AR",
    ring: "ring-emerald-500",
    bg: "bg-emerald-500",
    text: "text-emerald-500",
    border: "border-emerald-500",
    dot: "bg-emerald-500",
  },
}

export const NOTE_BORDER_COLORS: Record<string, string> = {
  follow_up: "border-l-blue-500",
  event: "border-l-amber-500",
  strong_answer: "border-l-emerald-500",
  weak_assumption: "border-l-orange-500",
  objection: "border-l-red-500",
}

export const RISK_COLOR = (score: number) => {
  if (score >= 70) return "bg-red-500"
  if (score >= 40) return "bg-amber-500"
  return "bg-emerald-500"
}
