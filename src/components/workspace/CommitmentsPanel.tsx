"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { deliveredItems, droppedItems, openItems, type Continuity } from "@/domains/types"
import { Panel } from "@/components/shared/Panel"

const SETTLED_SHOWN = 3

// The engagement's living memory: what the user committed to in past
// sessions. Open items are settled here (done feeds the next briefing as a
// win; dropped disappears from it); the next session's opener follows up on
// whatever stays open.
export const CommitmentsPanel = ({
  ideaId,
  continuity,
  className,
}: {
  ideaId: Id<"ideas">
  continuity: Continuity | null
  className?: string
}) => {
  const setStatus = useMutation(api.ideas.setActionItemStatus)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, SETTLED_SHOWN)
  const dropped = droppedItems(continuity).slice(0, SETTLED_SHOWN)

  const handleSettle = async (itemId: string, status: "done" | "dropped" | "open") => {
    if (settlingId) return
    setSettlingId(itemId)
    setFailed(false)
    try {
      await setStatus({ ideaId, itemId, status })
    } catch {
      setFailed(true)
    } finally {
      setSettlingId(null)
    }
  }

  return (
    <Panel title="Commitments" meta="the room follows up on these" className={className}>
      {open.length === 0 && delivered.length === 0 && dropped.length === 0 ? (
        <p className="text-[12.5px] text-on-surface-2">
          Nothing on the record yet. Commitments come out of each session&apos;s
          verdict, and the next session opens on them.
        </p>
      ) : (
        <ul>
          {open.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-[11px] border-t border-line py-[11px] first:border-t-0 first:pt-0"
            >
              <span className="min-w-0 flex-1 text-[13px] leading-[1.5]">{item.text}</span>
              <button
                type="button"
                onClick={() => handleSettle(item.id, "done")}
                disabled={settlingId !== null}
                aria-label={`Mark done: ${item.text}`}
                className="focus-ring flex-none border border-line-2 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-ok transition-colors hover:border-ok disabled:pointer-events-none disabled:opacity-50"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => handleSettle(item.id, "dropped")}
                disabled={settlingId !== null}
                aria-label={`Drop: ${item.text}`}
                className="focus-ring flex-none border border-line-2 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface-2 transition-colors hover:border-red hover:text-red-fg disabled:pointer-events-none disabled:opacity-50"
              >
                Drop
              </button>
            </li>
          ))}
          {delivered.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-[11px] border-t border-line py-[11px] text-on-surface-2 first:border-t-0 first:pt-0"
            >
              <span aria-hidden="true" className="flex-none font-mono font-semibold text-ok">
                ✓
              </span>
              <span className="sr-only">Delivered: </span>
              <span className="min-w-0 flex-1 text-[13px] leading-[1.5]">{item.text}</span>
              <button
                type="button"
                onClick={() => handleSettle(item.id, "open")}
                disabled={settlingId !== null}
                aria-label={`Reopen: ${item.text}`}
                className="focus-ring flex-none border border-line px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface-3 transition-colors hover:border-line-2 hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
              >
                Reopen
              </button>
            </li>
          ))}
          {dropped.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-[11px] border-t border-line py-[11px] text-on-surface-3 first:border-t-0 first:pt-0"
            >
              <span aria-hidden="true" className="flex-none font-mono font-semibold">
                ✕
              </span>
              <span className="sr-only">Dropped: </span>
              <span className="min-w-0 flex-1 text-[13px] leading-[1.5] line-through">
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => handleSettle(item.id, "open")}
                disabled={settlingId !== null}
                aria-label={`Reopen: ${item.text}`}
                className="focus-ring flex-none border border-line px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[.08em] text-on-surface-3 transition-colors hover:border-line-2 hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
              >
                Reopen
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-[13px] text-red-fg">
          That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </Panel>
  )
}
