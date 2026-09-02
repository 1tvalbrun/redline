import { v } from "convex/values"
import { action, internalAction, internalMutation, query } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { requireIdentity } from "./guard"
import { getPack, isPackId } from "../src/domains/registry"
import { firstNameOf } from "../src/domains/types"
import { endingContract, withTimeContract } from "../src/lib/ending"
import { CONNECT_GRACE_SEC } from "../src/lib/roomClock"

// Adopts a Runway Character for a pack persona (upsert). Internal on
// purpose: only the developer registers avatars, via
//   npx convex run avatars:register '{"packId":"founder","personaId":"vc-01","runwayAvatarId":"..."}'
export const register = internalMutation({
  args: {
    packId: v.string(),
    personaId: v.string(),
    runwayAvatarId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isPackId(args.packId)) throw new Error(`Unknown pack: ${args.packId}`)
    const pack = getPack(args.packId)
    if (!pack.personas.some((persona) => persona.id === args.personaId)) {
      throw new Error(`Unknown persona for ${args.packId}: ${args.personaId}`)
    }
    const existing = await ctx.db
      .query("avatars")
      .withIndex("by_pack_persona", (q) =>
        q.eq("packId", args.packId).eq("personaId", args.personaId)
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { runwayAvatarId: args.runwayAvatarId })
      return existing._id
    }
    return await ctx.db.insert("avatars", args)
  },
})

// The connect route's allowlist: sessions are billable, so it only mints
// them for registered avatars. Unregistered reads as false (fail closed).
export const allowed = query({
  args: { runwayAvatarId: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const avatar = await ctx.db
      .query("avatars")
      .withIndex("by_runway", (q) => q.eq("runwayAvatarId", args.runwayAvatarId))
      .first()
    return avatar !== null
  },
})

/* ---------- Session mint (the connect route's server half) ---------- */

const RUNWAY_API = "https://api.dev.runwayml.com"
// Pinned to the same version the @runwayml/sdk client sends.
const RUNWAY_VERSION = "2024-11-06"
// Runway caps the session personality override at 10,000 chars.
const PERSONALITY_CAP = 10_000

// Best-effort: if the Character can't be fetched, the session connects with
// the avatar's stored personality (server-side default) rather than failing.
const fetchStoredPersonality = async (
  apiKey: string,
  avatarId: string
): Promise<string | null> => {
  try {
    const res = await fetch(`${RUNWAY_API}/v1/avatars/${avatarId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    })
    if (!res.ok) return null
    const avatar = (await res.json()) as { status?: unknown; personality?: unknown }
    return avatar.status === "READY" &&
      typeof avatar.personality === "string" &&
      avatar.personality.length > 0
      ? avatar.personality
      : null
  } catch (err) {
    console.warn("[avatars.mint] personality fetch failed:", err)
    return null
  }
}

// One refusal vocabulary for the connect route to map onto its existing
// HTTP responses; the route's own poll/consume/cancel codes (queued,
// timeout, failed) stay route-side.
type MintResult =
  | { ok: true; runwaySessionId: string }
  | { ok: false; code: "unknown_avatar" | "unavailable" | "complete" | "cap" }

// The server half of /api/avatar/connect: authorizes, claims the billable
// connect, composes the session briefing, and creates the Runway realtime
// session. It lives in Convex so the briefing composition — which reads the
// blueprint's sealed questionPlan and rubric via internal.practices.getFull
// — never rides through a public query; the response carries ONLY the
// Runway session id, never the composed text. Public because the route
// calls it with the caller's own Convex token: every read inside is
// ownership-scoped, so a direct caller can only mint against their own
// live session (and pays their own claim slot for trying).
export const mint = action({
  args: {
    sessionId: v.id("sessions"),
    clientId: v.string(),
    avatarId: v.string(),
  },
  // Explicit return type breaks Convex's self-referential inference cycle
  // (mint → api → avatars.allowed), as at the other action call sites.
  handler: async (ctx, args): Promise<MintResult> => {
    await requireIdentity(ctx)

    // Sessions are billable, so minting requires an owned, live session
    // that features the requested avatar AND a registered avatar id. Any
    // failure authorizes nothing (fail closed).
    const [session, isAllowed] = await Promise.all([
      ctx.runQuery(api.sessions.get, { id: args.sessionId }),
      ctx.runQuery(api.avatars.allowed, { runwayAvatarId: args.avatarId }),
    ])
    if (!session || session.status !== "live") return { ok: false, code: "unknown_avatar" }
    if (session.persona.avatarId !== args.avatarId) return { ok: false, code: "unknown_avatar" }
    if (!isAllowed) return { ok: false, code: "unknown_avatar" }

    const apiKey = process.env.RUNWAYML_API_SECRET
    if (!apiKey) {
      console.error("[avatars.mint] RUNWAYML_API_SECRET is not set in the Convex deployment")
      return { ok: false, code: "unavailable" }
    }

    // Full practice (sealed fields included) for the briefing; reached
    // through the ownership-scoped session read above. Independent of the
    // personality fetch, so the two run in parallel.
    const [practice, storedPersonality] = await Promise.all([
      ctx.runQuery(internal.practices.getFull, { id: session.practiceId }),
      fetchStoredPersonality(apiKey, args.avatarId),
    ])
    if (!practice) return { ok: false, code: "unknown_avatar" }

    // Claim before minting: every Runway session is billed, so a session
    // that has hit its connect cap, run out of room time, or errors
    // mid-claim mints nothing (fail closed). The claim is also the
    // usage-meter write and the room-clock stamp.
    const claim = await ctx
      .runMutation(api.usage.claimAvatarConnect, {
        sessionId: args.sessionId,
        clientId: args.clientId,
      })
      .catch((err) => {
        console.warn("[avatars.mint] connect claim failed:", err)
        return null
      })
    if (claim === null) return { ok: false, code: "unavailable" }
    if (!claim.allowed) {
      if (claim.reason === "complete") return { ok: false, code: "complete" }
      if (claim.reason === "cap") return { ok: false, code: "cap" }
      return { ok: false, code: "unknown_avatar" }
    }

    // A previous attempt's Runway session may still be running: a client
    // that died mid-connect, a response lost in transport, a tab that never
    // got to abandon it. It holds the org's single concurrency slot, so
    // every new session would sit queued behind it until the ghost's five
    // minutes run out — observed on mobile as retries that never succeed.
    // The claim above was won, so whatever the doc recorded belongs to an
    // attempt this one supersedes; sweep it before creating. Best-effort:
    // deleting an already-finished session just 4xxes.
    if (session.runwaySessionId) {
      await fetch(`${RUNWAY_API}/v1/realtime_sessions/${session.runwaySessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": RUNWAY_VERSION,
        },
      }).catch((err) => {
        console.warn("[avatars.mint] stale session sweep failed:", err)
      })
    }

    const pack = getPack(practice.packId)
    const briefing = pack.briefing({
      scope: practice.scope,
      audit: practice.audit
        ? { claims: practice.audit.claims, gaps: practice.audit.gaps }
        : null,
      blueprint: practice.blueprint ?? null,
      continuity: practice.continuity ?? null,
      transcript: session.transcript,
    })

    // Floor, not round: a ninety second reconnect briefed as "two minutes"
    // overpromises; understating by up to a minute is the safe direction.
    const roomMinutes = Math.max(1, Math.floor(claim.maxDurationSec / 60))
    const contract = endingContract(firstNameOf(session.persona.name), roomMinutes)
    let personality: string | undefined
    if (storedPersonality) {
      const base = `${pack.turnTaking}${briefing.personalityPreamble}${storedPersonality}`
      const withContract = `${base}${contract}`
      // Runway caps personality at 10,000 chars. Same policy as
      // withTimeContract's startScript guard: the base personality wins over
      // the ending contract when space is short.
      if (withContract.length > PERSONALITY_CAP) {
        console.warn(
          `[avatars.mint] personality exceeds ${PERSONALITY_CAP} chars with the ending contract (${withContract.length}); dropping the contract`
        )
      }
      personality = withContract.length <= PERSONALITY_CAP ? withContract : base
      console.log(
        `[avatars.mint] session personality override applied (${personality.length} chars)`
      )
    }

    const created = await fetch(`${RUNWAY_API}/v1/realtime_sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gwm1_avatars",
        // The room clock starts at READY (sessions.markRoomStarted), but
        // Runway's window opens here at create — the grace keeps Runway
        // from hanging up before our clock lands the room. The briefed
        // minutes stay on the real budget.
        maxDuration: claim.maxDurationSec + CONNECT_GRACE_SEC,
        avatar: { type: "custom", avatarId: args.avatarId },
        ...(personality ? { personality } : {}),
        // Replaces the Character's canned opener, which otherwise repeats
        // verbatim every session, including resumes. The time contract makes
        // the wind-down a promise kept instead of a surprise.
        startScript: withTimeContract(briefing.startScript),
        // No tools: the ending client_event tools were removed 2026-08-25
        // after a confirmed agent wedge on tool-call turns. Ending authority
        // is server clock + speech grace + idle only.
      }),
    })
    if (!created.ok) {
      // Status only — Runway error bodies can carry org details, and this
      // message reaches the route's logs.
      throw new Error(`Runway session create failed (${created.status})`)
    }
    const payload = (await created.json()) as { id?: unknown }
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      throw new Error("Runway session create returned no id")
    }

    // Best-effort: keys Runway's post-session conversation record for
    // auditing sessions. The meter must never break the metered feature, so
    // a failed write here never fails the mint.
    await ctx
      .runMutation(internal.sessions.setRunwaySessionId, {
        id: args.sessionId,
        runwaySessionId: payload.id,
      })
      .catch((err) => {
        console.warn("[avatars.mint] runway session id record failed:", err)
      })

    return { ok: true, runwaySessionId: payload.id }
  },
})

// Frees the org's single concurrency slot the moment a session ends,
// instead of letting the Runway session run out its window — a lingering
// one makes the next room's mint queue behind it until it expires.
// Best-effort: an already-finished session just 4xxes.
export const release = internalAction({
  args: { runwaySessionId: v.string() },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RUNWAYML_API_SECRET
    if (!apiKey) return
    await fetch(`${RUNWAY_API}/v1/realtime_sessions/${args.runwaySessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    }).catch((err) => {
      console.warn("[avatars.release] runway session delete failed:", err)
    })
  },
})
