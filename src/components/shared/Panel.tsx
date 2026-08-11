import { cn } from "@/lib/utils"

type PanelProps = {
  title: string
  meta?: string
  className?: string
  children: React.ReactNode
}

export const Panel = ({ title, meta, className, children }: PanelProps) => (
  <section
    className={cn("rounded-xl border border-line bg-surface-raised p-5 shadow-card", className)}
  >
    <div className="mb-3.5 flex items-baseline justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
        {title}
      </h2>
      {meta && (
        <span className="font-mono text-[10.5px] tracking-[.02em] text-on-surface-3">{meta}</span>
      )}
    </div>
    {children}
  </section>
)
