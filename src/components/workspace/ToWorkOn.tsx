"use client"

import { useState } from "react"
import { Check, ChevronDown, FileText } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { cn, prefersReducedMotion } from "@/lib/utils"
import type { ActionItem, ActionItemPriority } from "@/domains/types"

const PRIORITY_RANK: Record<ActionItemPriority, number> = { high: 0, medium: 1, low: 2 }

// Must match duration-300 on the animated row wrappers, or rows unmount
// mid-collapse.
const EXIT_MS = 300

const DRAWER_TOGGLE_ID = "completed-toggle"

// Focus target once an actioned row unmounts, so keyboard users aren't
// dropped back to <body>.
const focusDrawerToggle = () => document.getElementById(DRAWER_TOGGLE_ID)?.focus()

const PriorityPill = ({ priority, muted }: { priority: ActionItemPriority; muted?: boolean }) => {
  if (priority !== "high") return null
  return (
    <span
      className={cn(
        "mt-0.5 rounded-full border border-warn-line bg-warn-bg px-2 py-px font-mono text-[10px] text-warn",
        muted && "opacity-40"
      )}
    >
      high
    </span>
  )
}

// One-way completion: clicking an open row marks it done and files it into
// the Completed drawer; the only way back is the explicit Reopen button.
export const ToWorkOn = ({
  practiceId,
  items,
  personaFirst,
  materials,
}: {
  practiceId: Id<"practices">
  items: ActionItem[]
  personaFirst: string | null
  materials: { materialId: string; name: string }[]
}) => {
  const setItemStatus = useMutation(api.practices.setActionItemStatus).withOptimisticUpdate(
    (localStore, args) => {
      const practice = localStore.getQuery(api.practices.get, { id: args.practiceId })
      if (!practice?.continuity) return
      localStore.setQuery(
        api.practices.get,
        { id: args.practiceId },
        {
          ...practice,
          continuity: {
            ...practice.continuity,
            actionItems: practice.continuity.actionItems.map((item) =>
              item.id === args.itemId
                ? {
                    ...item,
                    status: args.status,
                    settledAt: args.status === "open" ? undefined : Date.now(),
                  }
                : item
            ),
          },
        }
      )
    }
  )
  // Rows mid complete animation: already done in the (optimistic) data,
  // rendered collapsing in the open list and growing in at the top of the
  // drawer at the same time.
  const [exiting, setExiting] = useState<ReadonlySet<string>>(new Set())
  // Rows mid reopen animation: still done in the data (the status flip
  // fires when the collapse ends), rendered collapsing in the drawer and
  // growing in at the bottom of the open list at the same time.
  const [reopening, setReopening] = useState<ReadonlySet<string>>(new Set())
  // Items reopened this visit render at the bottom of the open list, in
  // reopen order, instead of resorting into the priority order.
  const [reopenedIds, setReopenedIds] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  const openCount = items.filter((item) => item.status === "open").length
  const openRows = items.filter((item) => item.status === "open" || exiting.has(item.id))
  const sortedOpen = [
    ...openRows
      .filter((item) => !reopenedIds.includes(item.id))
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt
      ),
    ...reopenedIds
      .map((id) => openRows.find((item) => item.id === id))
      .filter((item): item is ActionItem => item !== undefined),
  ]
  const openListRows = [
    ...sortedOpen,
    ...items.filter((item) => item.status !== "open" && reopening.has(item.id)),
  ]
  const settledRows = items
    .filter((item) => item.status !== "open")
    .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))

  const removeExiting = (itemId: string) =>
    setExiting((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })

  const handleMarkDone = (itemId: string) => {
    if (exiting.has(itemId)) return
    setFailed(false)
    setDrawerOpen(true)
    setExiting((prev) => new Set(prev).add(itemId))
    setReopenedIds((prev) => prev.filter((id) => id !== itemId))
    setItemStatus({ practiceId, itemId, status: "done" }).catch(() => {
      setFailed(true)
      removeExiting(itemId)
    })
    window.setTimeout(
      () => {
        removeExiting(itemId)
        focusDrawerToggle()
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    )
  }

  const handleToggleDrawer = () => setDrawerOpen((prev) => !prev)

  const handleReopen = (itemId: string) => {
    if (reopening.has(itemId)) return
    setFailed(false)
    setReopening((prev) => new Set(prev).add(itemId))
    window.setTimeout(
      () => {
        setReopening((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
        setReopenedIds((prev) => [...prev.filter((id) => id !== itemId), itemId])
        setItemStatus({ practiceId, itemId, status: "open" }).catch(() => {
          setFailed(true)
          setReopenedIds((prev) => prev.filter((id) => id !== itemId))
        })
        focusDrawerToggle()
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    )
  }

  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-baseline justify-between px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] text-on-surface-3">
          To work on
        </h2>
        <p className="text-xs text-on-surface-3">
          <b className="font-medium text-on-surface-2 tabular-nums">{openCount} open</b>
          {personaFirst && <> · {personaFirst} follows up on these</>}
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
        {openListRows.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-on-surface-3">
            Nothing outstanding — {personaFirst ?? "your panelist"} has no follow-ups waiting.
          </p>
        ) : (
          openListRows.map((item) => {
            const leaving = exiting.has(item.id)
            const entering = reopening.has(item.id)
            return (
              <div
                key={item.id}
                className={cn(
                  "grid border-b border-line transition-[grid-template-rows,opacity] duration-300 ease-in-out last:border-b-0 motion-reduce:transition-none",
                  leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
                  entering && "animate-row-in motion-reduce:animate-none"
                )}
              >
                <div className="overflow-hidden">
                  <button
                    type="button"
                    aria-label={`Mark done: ${item.text}`}
                    disabled={leaving || entering}
                    onClick={() => handleMarkDone(item.id)}
                    className="focus-ring group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-md border-[1.5px] border-line-2 bg-surface-raised transition-colors group-hover:border-accent-blue" />
                    <span className="flex-1 text-[13.5px] leading-snug">{item.text}</span>
                    <PriorityPill priority={item.priority} />
                  </button>
                </div>
              </div>
            )
          })
        )}

        {settledRows.length > 0 && (
          <>
            <button
              id={DRAWER_TOGGLE_ID}
              type="button"
              aria-expanded={drawerOpen}
              aria-controls="completed-drawer"
              onClick={handleToggleDrawer}
              className="focus-ring flex w-full items-center gap-1.5 border-t border-line bg-surface px-4 py-2.5 text-[12.5px] text-on-surface-3 transition-colors hover:bg-surface-2"
            >
              Completed ·{" "}
              <b className="font-medium tabular-nums text-on-surface-2">{settledRows.length}</b>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "ml-auto size-3.5 text-ink-4 transition-transform duration-300 ease-brand motion-reduce:transition-none",
                  drawerOpen && "rotate-180"
                )}
              />
            </button>
            <div
              id="completed-drawer"
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-brand motion-reduce:transition-none",
                drawerOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden" inert={!drawerOpen || undefined}>
                {settledRows.map((item) => {
                  const leaving = reopening.has(item.id)
                  const entering = exiting.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "grid border-b border-line transition-[grid-template-rows,opacity] duration-300 ease-in-out last:border-b-0 motion-reduce:transition-none",
                        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
                        entering && "animate-row-in motion-reduce:animate-none"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-start gap-3 bg-surface px-4 py-3">
                          {item.status === "done" ? (
                            <span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-md border-[1.5px] border-ok bg-ok">
                              <Check className="size-[11px] text-white" strokeWidth={3.4} />
                            </span>
                          ) : (
                            <span className="mt-0.5 font-mono text-[10px] text-on-surface-3">
                              dropped
                            </span>
                          )}
                          <span className="flex-1 text-[13.5px] leading-snug text-on-surface-3 line-through decoration-ink-4">
                            {item.text}
                          </span>
                          <PriorityPill priority={item.priority} muted />
                          <button
                            type="button"
                            aria-label={`Reopen: ${item.text}`}
                            disabled={leaving || entering}
                            onClick={() => handleReopen(item.id)}
                            className="focus-ring flex-none rounded-full border border-line-2 bg-surface-raised px-[11px] py-[3px] text-[11.5px] text-on-surface-3 transition-colors hover:border-accent-line hover:bg-accent-bg hover:text-accent-blue"
                          >
                            Reopen
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {failed && (
          <p role="alert" className="border-t border-line px-4 py-2.5 text-[12.5px] text-red-fg">
            That didn&apos;t go through. Check your connection and try again.
          </p>
        )}

        {materials.length > 0 && personaFirst && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-2.5">
            <span className="text-xs text-on-surface-3">{personaFirst} reads:</span>
            {materials.map((material) => (
              <span
                key={material.materialId}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface-raised px-2.5 py-1 text-xs text-on-surface-2"
              >
                <FileText className="size-[11px] text-on-surface-3" />
                {material.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
