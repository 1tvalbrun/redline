import type { Auth } from "convex/server"

// The one authorization check, reused by every public function. Convex
// requests bypass the Next middleware entirely, so this is the actual
// security boundary for the backend.
export const requireIdentity = async (ctx: { auth: Auth }) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  return identity
}
