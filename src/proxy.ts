import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// Invited-tester gate: everything requires a session except the sign-in
// page itself. Convex traffic never passes through here — the browser talks
// to Convex directly — so the function layer re-checks identity via
// requireIdentity (convex/guard.ts).
const isPublicRoute = createRouteMatcher(["/sign-in(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect()
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
