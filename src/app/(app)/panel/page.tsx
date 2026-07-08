"use client"

import Image from "next/image"
import { DEFAULT_CHARACTERS } from "@/components/simulation/characters"

const PANEL_COPY: Record<string, { role: string; description: string; tags: string[] }> = {
  "vc-01": {
    role: "The VC",
    description:
      "Reviewed 2,000+ pitches, backed 23, watched 11 fail. Comes for market size, moats, pricing power and round math.",
    tags: ["Market sizing", "Defensibility", "Pricing power"],
  },
  "tc-01": {
    role: "The buyer",
    description:
      "Plays your real customer. Asks what it replaces, what switching costs, and what happens when it breaks at 11pm.",
    tags: ["Buying process", "Switching cost", "Procurement"],
  },
  "ta-01": {
    role: "The architect",
    description:
      "Thinks in failure modes. Flags accuracy claims with no methodology and \"optimize later\" in the critical path.",
    tags: ["Latency", "Reliability", "Build vs buy"],
  },
}

const PanelPage = () => {
  return (
    <div>
      <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold">The Panel</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.55] text-on-surface-2">
        Three experts, three incentives. Each interrogates from a different angle,
        grounded in your brief. All three are active; you pick one interrogator for
        each run when a stress test starts.
      </p>

      <div className="mt-[26px] grid gap-5 md:grid-cols-3">
        {DEFAULT_CHARACTERS.map((char) => {
          const copy = PANEL_COPY[char.id]
          return (
            <article key={char.id} className="overflow-hidden border border-line-2 bg-surface-raised">
              <div className="relative aspect-square bg-[#1C1C1E]">
                <Image
                  src={char.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <span className="absolute bottom-4 left-4 font-mono text-[9.5px] uppercase tracking-[.16em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
                  {copy.role}
                </span>
              </div>
              <div className="p-[18px]">
                <h2 className="font-display text-xl font-bold tracking-[-.01em]">{char.name}</h2>
                <p className="mt-[3px] text-[12.5px] text-on-surface-2">{char.role}</p>
                <p className="mt-3.5 text-[13.5px] leading-[1.5]">{copy.description}</p>
                <ul className="mt-3.5 flex flex-wrap gap-1.5">
                  {copy.tags.map((tag) => (
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
          )
        })}
      </div>
    </div>
  )
}

export default PanelPage
