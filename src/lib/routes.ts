// The one list of routes that render without a session: sign-in has no
// Convex queries, and the legal pages must be readable before an account
// exists. Consumed by both boundaries, the Next middleware (src/proxy.ts)
// and the client auth gate (src/app/providers.tsx), so a new public page
// is added here, once.
export const PUBLIC_PATHS = ["/sign-in", "/terms", "/privacy"]

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
