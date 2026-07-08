type StubItem = { k: string; title: string; description: string }

type StubPageProps = {
  title: string
  lead: string
  items: StubItem[]
}

export const StubPage = ({ title, lead, items }: StubPageProps) => (
  <div className="max-w-[640px]">
    <h1 className="font-display text-[clamp(28px,3.2vw,40px)] font-bold tracking-[-.01em]">
      {title}
    </h1>
    <p className="mt-3.5 text-base leading-[1.6] text-on-surface-2">{lead}</p>
    <ul className="mt-[26px] border-t border-line-2">
      {items.map((item) => (
        <li key={item.k} className="flex gap-3.5 border-b border-line py-4">
          <span className="w-10 flex-none pt-[3px] font-mono text-[10px] tracking-[.1em] text-red-fg">
            {item.k}
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{item.title}</span>
            <span className="mt-[3px] block text-[13.5px] leading-[1.5] text-on-surface-2">
              {item.description}
            </span>
          </span>
        </li>
      ))}
    </ul>
    <p className="mt-6 inline-block border border-line-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-on-surface-3">
      On the roadmap
    </p>
  </div>
)
