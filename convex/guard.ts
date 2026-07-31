import type { Auth, UserIdentity } from "convex/server"

// The one authorization check, reused by every public function. Convex
// requests bypass the Next middleware entirely, so this is the actual
// security boundary for the backend.
export const requireIdentity = async (ctx: { auth: Auth }) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  return identity
}

// Ownership filter for single-document reads: someone else's document reads
// exactly like a missing one — null, with no existence leak.
// identity.subject is the Clerk user id stamped as userId at insert.
export const ownedOrNull = <T extends { userId: string }>(
  identity: UserIdentity,
  doc: T | null
): T | null => {
  if (!doc || doc.userId !== identity.subject) return null
  return doc
}
