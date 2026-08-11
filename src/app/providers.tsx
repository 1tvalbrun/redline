"use client"

import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { RedirectToSignIn, useAuth } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect } from "react"
import { api } from "@convex/_generated/api"
import { isPublicPath } from "@/lib/routes"
import { LogoMark } from "@/components/shared/LogoMark"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface">
    <p className="flex items-center gap-3 text-[28px] font-semibold tracking-[-.02em] text-on-surface">
      <LogoMark size="lg" />
      Prestage
    </p>
  </div>
)

// A signed-in user without a users row hasn't finished onboarding (or
// deleted their account). Everything except /welcome sends them there, and
// /welcome bounces back out once the row exists, which is also what
// navigates after the onboarding mutation lands.
const OnboardingGate = ({ children }: { children: ReactNode }) => {
  const user = useQuery(api.users.getCurrent)
  const pathname = usePathname()
  const router = useRouter()
  const onWelcome = pathname === "/welcome"
  const target = user === null && !onWelcome ? "/welcome" : user && onWelcome ? "/" : null

  useEffect(() => {
    if (user === undefined || !target) return
    router.replace(target)
  }, [user, target, router])

  if (user === undefined || target) return <Splash />
  return children
}

// Convex authenticates its socket asynchronously after Clerk's session
// loads — a query mounted inside that window runs unauthenticated and
// throws against the requireIdentity guards. So protected routes wait out
// the handshake behind a splash, and a session that dies mid-visit (signed
// out in another tab, revoked) redirects instead of letting the live
// queries re-run unauthenticated.
const ConvexAuthGate = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const pathname = usePathname()

  if (isPublicPath(pathname)) return children
  if (isLoading) return <Splash />
  if (!isAuthenticated) return <RedirectToSignIn />
  return <OnboardingGate>{children}</OnboardingGate>
}

export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <ConvexAuthGate>{children}</ConvexAuthGate>
    </ConvexProviderWithClerk>
  )
}
