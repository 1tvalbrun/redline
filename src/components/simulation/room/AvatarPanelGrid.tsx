import { CharacterTile } from "./CharacterTile"

type Character = {
  id: string
  archetypeId: string
  name: string
  role: string
  avatarId: string
  tone: string
  systemPrompt: string
  status: string
}

type AvatarPanelGridProps = {
  characters: Character[]
  activeCharacterId?: string
}

export const AvatarPanelGrid = ({ characters, activeCharacterId }: AvatarPanelGridProps) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {characters.map((character) => (
        <CharacterTile
          key={character.id}
          character={character}
          isActive={character.id === activeCharacterId}
        />
      ))}
    </div>
  )
}
