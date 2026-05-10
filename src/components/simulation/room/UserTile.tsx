import { Card, CardContent } from "@/components/ui/card"

export const UserTile = () => {
  return (
    <Card className="border-primary/20">
      <CardContent className="flex flex-col items-center gap-2 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-2xl font-bold text-primary">You</span>
        </div>
        <p className="text-sm font-medium">Founder</p>
        <p className="text-xs text-muted-foreground">Presenting</p>
      </CardContent>
    </Card>
  )
}
