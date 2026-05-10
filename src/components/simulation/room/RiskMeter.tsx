import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type RiskScores = {
  market?: number
  customer?: number
  technical?: number
  gtm?: number
}

type RiskMeterProps = {
  scores: RiskScores
}

const RISK_LABELS: Record<string, string> = {
  market: "Market",
  customer: "Customer",
  technical: "Technical",
  gtm: "GTM",
}

export const RiskMeter = ({ scores }: RiskMeterProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Risk Assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(RISK_LABELS).map(([key, label]) => {
          const value = scores[key as keyof RiskScores] ?? 0
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{label}</span>
                <span className="text-muted-foreground">{value}/100</span>
              </div>
              <Progress value={value} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
