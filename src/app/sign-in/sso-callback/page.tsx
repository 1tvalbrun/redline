"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

// Landing spot for the Google OAuth redirect; Clerk finishes the session
// here, then sends the user on.
const SsoCallbackPage = () => (
  <main className="flex min-h-dvh items-center justify-center bg-surface">
    <p className="font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
      Signing you in…
    </p>
    <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" />
  </main>
)

export default SsoCallbackPage
