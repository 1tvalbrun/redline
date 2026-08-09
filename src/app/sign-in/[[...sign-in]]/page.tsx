"use client"

import { SignIn } from "@clerk/nextjs"
import { useClerkAppearance } from "@/components/shared/useClerkAppearance"

const SignInPage = () => {
  const appearance = useClerkAppearance()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-surface p-6">
      <div className="flex flex-col items-center text-center">
        <p className="flex items-center gap-3 text-[28px] font-semibold tracking-[-.02em] text-on-surface">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-[9px] bg-on-surface"
          >
            <span className="block h-1 w-4 rounded-[2px] bg-red" />
          </span>
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
