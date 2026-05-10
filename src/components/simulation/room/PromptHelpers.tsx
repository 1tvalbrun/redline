const PROMPTS = [
  "Our wedge is...",
  "The reason this is urgent...",
  "What would change my mind is...",
  "Counter-argument...",
]

type PromptHelpersProps = {
  onSelect: (prompt: string) => void
}

export const PromptHelpers = ({ onSelect }: PromptHelpersProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Prompt Helpers
      </span>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className="rounded-lg border border-border px-2.5 py-1.5 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
