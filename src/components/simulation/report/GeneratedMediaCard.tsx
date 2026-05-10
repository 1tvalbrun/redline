import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type GeneratedMediaCardProps = {
  media: {
    successVideo?: string
    failureVideo?: string
  }
  status: string
}

export const GeneratedMediaCard = ({ media, status }: GeneratedMediaCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Generated Media
          <Badge variant="secondary">{status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === "generating" && (
          <p className="text-sm text-muted-foreground">
            Generating cinematic videos with Runway...
          </p>
        )}
        {status === "complete" && (
          <div className="grid gap-4 md:grid-cols-2">
            {media.successVideo && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Success Scenario</p>
                <div className="aspect-video rounded-lg bg-muted" />
              </div>
            )}
            {media.failureVideo && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Failure Scenario</p>
                <div className="aspect-video rounded-lg bg-muted" />
              </div>
            )}
          </div>
        )}
        {status === "skipped" && (
          <p className="text-sm text-muted-foreground">
            Video generation skipped (demo mode).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
