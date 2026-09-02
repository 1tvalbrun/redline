"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/shared/buttons"

const CODE_LENGTH = 6

const MONO_LINK =
  "focus-ring font-mono text-[10px] uppercase tracking-[.09em] text-on-surface-3 hover:text-on-surface-2 max-md:py-2"

const GoogleIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
    />
  </svg>
)

// Custom Clerk sign-in (no prebuilt component): Google OAuth or a six-digit
// email code, rendered entirely in our own markup.
export const SignInFlow = () => {
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const busy = fetchStatus === "fetching"

  const stepFieldError = step === "code" ? errors?.fields?.code : errors?.fields?.identifier
  // A failed OAuth attempt (e.g. a non-invited Google account) redirects back
  // here with the failure on the verification, not in `errors`.
  const oauthError = signIn.firstFactorVerification?.error
  const errorMessage =
    stepFieldError?.message ??
    errors?.global?.[0]?.message ??
    oauthError?.longMessage ??
    oauthError?.message

  const handleGoogle = () => {
    void signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/",
      redirectCallbackUrl: "/sign-in/sso-callback",
    })
  }

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !email) return
    const { error } = await signIn.emailCode.sendCode({ emailAddress: email })
    if (!error) {
      setCode("")
      setStep("code")
    }
  }

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || code.length < CODE_LENGTH) return
    const { error } = await signIn.emailCode.verifyCode({ code })
    if (error) return
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/")
        // decorateUrl may return an absolute URL for Safari ITP
        if (url.startsWith("http")) {
          window.location.href = url
        } else {
          router.push(url)
        }
      },
    })
  }

  const handleUseDifferentEmail = () => {
    setCode("")
    setStep("email")
  }

  if (step === "code") {
    return (
      <div className="flex w-full flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[20px] font-semibold tracking-[-.015em]">Check your email</h2>
          <p className="font-mono text-[11px] tracking-[.02em] text-on-surface-3 [overflow-wrap:anywhere]">
            We sent a code to {email}
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="flex w-full flex-col items-center gap-4">
          <div className="group relative">
            <label htmlFor="code" className="sr-only">
              Six-digit code
            </label>
            <input
              id="code"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="absolute inset-0 opacity-0"
            />
            <div aria-hidden="true" className="pointer-events-none flex gap-2.5 max-md:gap-1.5">
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "grid h-14 w-12 place-items-center rounded-[10px] border border-line-2 bg-surface-raised font-mono text-[20px] font-medium max-md:h-12 max-md:w-10",
                    i === code.length &&
                      "group-focus-within:border-accent-blue group-focus-within:ring-[3px] group-focus-within:ring-accent-blue/20"
                  )}
                >
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || code.length < CODE_LENGTH}
            className={cn(BTN_PRIMARY, "h-11 w-full")}
          >
            {busy ? "Checking…" : "Continue"}
          </button>
          {errorMessage && (
            <p role="alert" className="text-center text-[13px] text-red-fg">
              {errorMessage}
            </p>
          )}
        </form>

        <div className="flex gap-5">
          <button
            type="button"
            onClick={() => void signIn.emailCode.sendCode({ emailAddress: email })}
            disabled={busy}
            className={cn(MONO_LINK, "disabled:opacity-50")}
          >
            Resend code
          </button>
          <button type="button" onClick={handleUseDifferentEmail} className={MONO_LINK}>
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-[20px] font-semibold tracking-[-.015em]">Sign in</h2>
        <p className="font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
          Sign in to enter
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className={cn(BTN_SECONDARY, "h-11 w-full")}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-[.09em] text-on-surface-3">
            or
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSendCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="focus-ring h-11 w-full rounded-[10px] border border-line-2 bg-surface-raised px-3.5 text-[14px] placeholder:text-on-surface-3"
          />
          <button type="submit" disabled={busy} className={cn(BTN_PRIMARY, "h-11 w-full")}>
            {busy ? "Sending…" : "Continue with email"}
          </button>
          {errorMessage && (
            <p role="alert" className="text-center text-[13px] text-red-fg">
              {errorMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
