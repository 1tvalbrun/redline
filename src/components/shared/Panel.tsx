import { cn } from "@/lib/utils"

type PanelProps = {
  title: string
  meta?: string
  className?: string
  children: React.ReactNode
}

export const Panel = ({ title, meta, className, children }: PanelProps) => (
  <section className={cn("border border-line-2 bg-surface-raised p-5", className)}>
    <div className="mb-3.5 flex items-baseline justify-between">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
        {title}
      </h2>
      {meta && (
        <span className="font-mono text-[10px] uppercase tracking-[.05em] text-on-surface-3">
          {meta}
        </span>
      )}
    </div>
    {children}
  </section>
)
