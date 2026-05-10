"use client"

import { Button } from "@/components/ui/button"

const PROMPTS = [
  "Tell me more about the market risk",
  "What about the competition?",
  "How would you price this?",
  "What's the biggest technical challenge?",
  "Would you actually use this?",
]

type PromptHelpersProps = {
  onSelect: (prompt: string) => void
}

export const PromptHelpers = ({ onSelect }: PromptHelpersProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {PROMPTS.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  )
}
