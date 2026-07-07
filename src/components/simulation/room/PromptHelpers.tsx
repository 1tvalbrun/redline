"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const PROMPTS = [
  "Our wedge is…",
  "The reason this is urgent…",
  "What would change your mind…",
  "The honest counter-argument…",
]

export const PromptHelpers = ({ className }: { className?: string }) => {
  const [selected, setSelected] = useState<string | null>(null)

  const handleToggle = (prompt: string) => {
    setSelected((current) => (current === prompt ? null : prompt))
  }

  return (
    <div className={className}>
      <p className="mb-[10px] font-mono text-[9.5px] uppercase tracking-[.16em] text-on-surface-2">
        Prompt helpers
      </p>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          aria-pressed={selected === prompt}
          onClick={() => handleToggle(prompt)}
          className={cn(
            "focus-ring mb-[6px] block w-full border px-[11px] py-[9px] text-left text-[12.5px] transition-colors",
            selected === prompt
              ? "border-line-2 bg-surface-3 text-on-surface"
              : "border-line bg-surface-3 text-on-surface-2 hover:border-line-2 hover:text-on-surface"
          )}
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
