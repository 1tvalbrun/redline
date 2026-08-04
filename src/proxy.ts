import { clerkMiddleware } from "@clerk/nextjs/server"
import { isPublicPath } from "./lib/routes"

// Invited-tester gate: everything requires a session except the PUBLIC_PATHS
// (sign-in, legal pages), checked with the same isPublicPath the client auth
// gate uses. Convex traffic never passes through here (the browser talks to
// Convex directly), so the function layer re-checks identity via
// requireIdentity (convex/guard.ts).
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicPath(req.nextUrl.pathname)) await auth.protect()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/:path*",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
