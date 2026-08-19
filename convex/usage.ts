import { v } from "convex/values"
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { requireIdentity, ownedOrNull } from "./guard"
import { usageKindValidator, type UsageKind } from "./schema"
import {
  openAiCostUsd,
  RUNWAY_CONNECT_USD,
  emptyTotals,
  addEvent,
  addSession,
  finalizeTotals,
  type UsageTotals,
} from "../src/lib/usage"
import { lastActivityAt } from "../src/lib/session"

// Internal only: every OpenAI call site records here with a userId taken
// from the owning document (or the verified identity), never from client
// arguments.
export const record = internalMutation({
  args: {
    userId: v.string(),
    kind: usageKindValidator,
    practiceId: v.optional(v.id("practices")),
    sessionId: v.optional(v.id("sessions")),
    model: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageEvents", {
      ...args,
      costUsd: openAiCostUsd(args.model ?? "", args.inputTokens ?? 0, args.outputTokens ?? 0),
    })
  },
})

// The meter must never break the metered feature: a failed write is logged
// and swallowed. Actions call this instead of internal.usage.record directly.
export const recordUsage = async (
  ctx: ActionCtx,
  event: {
    userId: string
    kind: UsageKind
    practiceId?: Id<"practices">
    sessionId?: Id<"sessions">
    model?: string
    inputTokens?: number
    outputTokens?: number
  }
): Promise<void> => {
  try {
    await ctx.runMutation(internal.usage.record, event)
  } catch (error) {
    console.error("[usage.record]", error)
  }
}

// Claim-before-mint for the avatar connect route: every Runway realtime
// session is billed, so the route asks here first and a denied claim means
// no mint. The cap is a sanity bound no legitimate room hits — it exists so
// reconnect-chaining can't spend without limit. Public because the route
// runs with the caller's own Convex token: userId comes from the identity
// and the session must be owned, so a direct caller can only claim (and
// count) against their own session. Atomic: mutations serialize, so
// concurrent claims can't slip past the cap.
const MAX_CONNECTS_PER_SESSION = 5

export const claimAvatarConnect = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<{ allowed: boolean }> => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.sessionId))
    if (!session) return { allowed: false }
    const prior = await ctx.db
      .query("usageEvents")
      .withIndex("by_session_kind", (q) =>
        q.eq("sessionId", args.sessionId).eq("kind", "avatar_connect")
      )
      .take(MAX_CONNECTS_PER_SESSION)
    if (prior.length >= MAX_CONNECTS_PER_SESSION) return { allowed: false }
    await ctx.db.insert("usageEvents", {
      userId: identity.subject,
      kind: "avatar_connect",
      practiceId: session.practiceId,
      sessionId: args.sessionId,
      costUsd: RUNWAY_CONNECT_USD,
    })
    return { allowed: true }
  },
})

/* ---------- Admin rollup (npx convex run usage:summary '{}') ---------- */

// Page queries return only the fields the fold needs, bounded per call so
// the rollup never trips Convex's per-query read limits. Sessions page
// small: transcripts make the documents heavy.
const cursorValidator = v.union(v.string(), v.null())

export const eventsPage = internalQuery({
  args: { cutoff: v.number(), cursor: cursorValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("usageEvents")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", args.cutoff))
      .paginate({ numItems: 500, cursor: args.cursor })
    return {
      page: result.page.map((event) => ({
        userId: event.userId,
        kind: event.kind as string,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        costUsd: event.costUsd,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

export const sessionsPage = internalQuery({
  args: { cutoff: v.number(), cursor: cursorValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("sessions")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", args.cutoff))
      .paginate({ numItems: 100, cursor: args.cursor })
    return {
      page: result.page.map((session) => ({
        userId: session.userId,
        createdAt: session._creationTime,
        endedAt: session.endedAt,
        lastActivityAt: lastActivityAt(session.transcript, session._creationTime),
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

export const displayNames = internalQuery({
  args: { clerkIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const pairs: [string, string | undefined][] = []
    for (const clerkId of args.clerkIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
        .unique()
      pairs.push([clerkId, user?.displayName])
    }
    return pairs
  },
})

type SummaryRow = ReturnType<typeof finalizeTotals> & {
  userId: string
  displayName: string | undefined
}

// Explicit page shapes break Convex's self-referential inference cycle
// (summary → internal.usage → summary), as at the other action call sites.
type Page<T> = { page: T[]; continueCursor: string; isDone: boolean }
type EventRow = {
  userId: string
  kind: string
  inputTokens?: number
  outputTokens?: number
  costUsd: number
}
type SessionRow = { userId: string; createdAt: number; endedAt?: number; lastActivityAt: number }

// Never client-callable. Defaults to the last 30 days; pass a larger
// sinceDays for history. Avatar minutes and STT are estimated from session
// durations (addSession carries the staleness cap for abandoned rooms).
export const summary = internalAction({
  args: { sinceDays: v.optional(v.number()) },
  handler: async (ctx, args): Promise<SummaryRow[]> => {
    const now = Date.now()
    const cutoff = now - (args.sinceDays ?? 30) * 24 * 60 * 60_000

    const totalsByUser = new Map<string, UsageTotals>()
    const totalsFor = (userId: string): UsageTotals => {
      const existing = totalsByUser.get(userId)
      if (existing) return existing
      const totals = emptyTotals()
      totalsByUser.set(userId, totals)
      return totals
    }

    let cursor: string | null = null
    do {
      const result: Page<EventRow> = await ctx.runQuery(internal.usage.eventsPage, {
        cutoff,
        cursor,
      })
      for (const event of result.page) addEvent(totalsFor(event.userId), event)
      cursor = result.isDone ? null : result.continueCursor
    } while (cursor)

    do {
      const result: Page<SessionRow> = await ctx.runQuery(internal.usage.sessionsPage, {
        cutoff,
        cursor,
      })
      for (const session of result.page) addSession(totalsFor(session.userId), { ...session, now })
      cursor = result.isDone ? null : result.continueCursor
    } while (cursor)

    const names = new Map<string, string | undefined>(
      await ctx.runQuery(internal.usage.displayNames, { clerkIds: [...totalsByUser.keys()] })
    )
    return [...totalsByUser.entries()]
      .map(([userId, totals]) => ({
        userId,
        displayName: names.get(userId),
        ...finalizeTotals(totals),
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
  },
})
