import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Character = {
  id: string
  archetypeId: string
  name: string
  role: string
  status: string
}

type CharacterTileProps = {
  character: Character
  isActive: boolean
}

export const CharacterTile = ({ character, isActive }: CharacterTileProps) => {
  return (
    <Card className={cn(
      "transition-all",
      isActive && "ring-2 ring-primary shadow-lg"
    )}>
      <CardContent className="flex flex-col items-center gap-2 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <span className="text-2xl font-bold text-muted-foreground">
            {character.name[0]}
          </span>
        </div>
        <p className="text-sm font-medium">{character.name}</p>
        <p className="text-xs text-muted-foreground">{character.role}</p>
        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
          {character.status}
        </Badge>
      </CardContent>
    </Card>
  )
}
