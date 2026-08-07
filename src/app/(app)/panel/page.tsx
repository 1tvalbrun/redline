"use client"

import Image from "next/image"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { getPack, isPackId, ALL_PACKS } from "@/domains/registry"

const PanelPage = () => {
  const user = useQuery(api.users.getCurrent)
  if (user === undefined) return null

  const lanes = (user?.lanes ?? []).filter(isPackId)
  const packs = lanes.length > 0 ? lanes.map((lane) => getPack(lane)) : ALL_PACKS

  return (
    <div>
      <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">The Panel</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.55] text-on-surface-2">
        Every interrogator you can face, grounded in what you bring. You pick
        one for each run.
      </p>

      {packs.map((pack) => (
        <section key={pack.id} aria-label={pack.label} className="mt-[26px]">
          {packs.length > 1 && (
            <h2 className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[.16em] text-on-surface-2">
              {pack.label}
            </h2>
          )}
          <div className="grid gap-5 md:grid-cols-3">
            {pack.personas.map((persona) => (
              <article
                key={persona.id}
                className="overflow-hidden border border-line-2 bg-surface-raised"
              >
                <div className="relative aspect-square bg-[#1C1C1E]">
                  <Image
                    src={persona.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <span className="absolute bottom-4 left-4 font-mono text-[9.5px] uppercase tracking-[.16em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
                    {persona.shortRole}
                  </span>
                </div>
                <div className="p-[18px]">
                  <h3 className="font-display text-xl font-bold tracking-[-.01em]">
                    {persona.name}
                  </h3>
                  <p className="mt-[3px] text-[12.5px] text-on-surface-2">{persona.role}</p>
                  <p className="mt-3.5 text-[13.5px] leading-[1.5]">{persona.bio}</p>
                  <ul className="mt-3.5 flex flex-wrap gap-1.5">
                    {persona.tags.map((tag) => (
                      <li
                        key={tag}
                        className="border border-line-2 px-[7px] py-[3px] font-mono text-[9.5px] uppercase tracking-[.04em] text-on-surface-2"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default PanelPage
