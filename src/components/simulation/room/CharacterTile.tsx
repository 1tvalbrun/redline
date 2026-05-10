import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { ARCHETYPE_CONFIG } from "./constants"

type CharacterTileProps = {
  character: {
    id: string
    archetypeId: string
    name: string
    role: string
    status: string
  }
  isActive: boolean
}

export const CharacterTile = ({ character, isActive }: CharacterTileProps) => {
  const config = ARCHETYPE_CONFIG[character.archetypeId]
  if (!config) return null

  const isEngaged = character.status === "speaking" || character.status === "challenging"

  return (
    <div
      className={cn(
        "relative flex aspect-video flex-col justify-between rounded-xl bg-[#1C1C1E] p-4 transition-all duration-300",
        isActive ? `ring-2 ${config.ring} scale-[1.02]` : "opacity-70"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">
          {config.label}
        </span>
        {isEngaged && (
          <Activity className="h-4 w-4 text-white/60" />
        )}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10",
          isActive && `border-${character.archetypeId === "vc" ? "blue" : character.archetypeId === "target_customer" ? "amber" : "emerald"}-500/30`
        )}>
          <span className="text-2xl font-light tracking-wider text-white/40">
            {config.initials}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-white/80">{character.name}</p>
        <p className="text-[10px] text-white/40">{character.role}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            isEngaged ? config.dot : "bg-white/30"
          )} />
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
            {character.status}
          </span>
        </div>
      </div>
    </div>
  )
}
