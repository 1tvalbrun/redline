"use client"

import { SignIn } from "@clerk/nextjs"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"
import { LogoMark } from "@/components/shared/LogoMark"

const SignInPage = () => {
  const appearance = useClerkAppearance()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-surface p-6">
      <div className="flex flex-col items-center text-center">
        <p className="flex items-center gap-3 text-[28px] font-semibold tracking-[-.02em] text-on-surface">
          <LogoMark size="lg" />
          Redline
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
          Invited testing · sign in to enter
        </p>
      </div>
      <SignIn appearance={appearance} />
    </main>
  )
}

export default SignInPage
