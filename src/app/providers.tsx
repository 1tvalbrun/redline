"use client"

import { ConvexReactClient, useConvexAuth } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { RedirectToSignIn, useAuth } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { ReactNode } from "react"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Convex authenticates its socket asynchronously after Clerk's session
// loads — a query mounted inside that window runs unauthenticated and
// throws against the requireIdentity guards. So protected routes wait out
// the handshake behind a splash, and a session that dies mid-visit (signed
// out in another tab, revoked) redirects instead of letting the live
// queries re-run unauthenticated. /sign-in has no Convex queries and must
// render while signed out.
const ConvexAuthGate = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const pathname = usePathname()

  if (pathname.startsWith("/sign-in")) return children
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="font-display text-[34px] font-bold tracking-[-.02em] text-on-surface">
          Redline
        </p>
      </div>
    )
  }
  if (!isAuthenticated) return <RedirectToSignIn />
  return children
}

export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <ConvexAuthGate>{children}</ConvexAuthGate>
    </ConvexProviderWithClerk>
  )
}
