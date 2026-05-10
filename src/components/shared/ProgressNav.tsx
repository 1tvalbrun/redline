import { cn } from "@/lib/utils"

type Step = {
  label: string
  status: "complete" | "current" | "upcoming"
}

type ProgressNavProps = {
  steps: Step[]
}

export const ProgressNav = ({ steps }: ProgressNavProps) => {
  return (
    <nav className="flex items-center gap-2" aria-label="Simulation progress">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                step.status === "complete" && "bg-primary text-primary-foreground",
                step.status === "current" && "border-2 border-primary text-primary",
                step.status === "upcoming" && "border border-border text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-xs",
                step.status === "current" ? "font-medium" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-px w-8 bg-border" />
          )}
        </div>
      ))}
    </nav>
  )
}
