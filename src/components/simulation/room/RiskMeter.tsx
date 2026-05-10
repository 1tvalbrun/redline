import { RISK_COLOR } from "./constants"

type RiskScores = {
  market?: number
  customer?: number
  technical?: number
  gtm?: number
}

type RiskMeterProps = {
  scores: RiskScores
}

const RISK_ROWS: { key: keyof RiskScores; label: string }[] = [
  { key: "market", label: "Market risk" },
  { key: "customer", label: "Customer risk" },
  { key: "technical", label: "Technical risk" },
  { key: "gtm", label: "GTM risk" },
]

export const RiskMeter = ({ scores }: RiskMeterProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Risk Meter
      </span>
      <div className="mt-3 space-y-3">
        {RISK_ROWS.map(({ key, label }) => {
          const value = scores[key] ?? 0
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">{label}</span>
                <span className="text-xs font-medium">{value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${RISK_COLOR(value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
