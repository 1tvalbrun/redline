"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { ALL_PACKS } from "@/domains/registry"
import { Disclosure } from "@/components/shared/Disclosure"
import { BrandName } from "@/components/shared/BrandName"

// First-run onboarding: pick a lane, accept the terms, enter. Success needs
// no navigation here; the users row appearing flips the OnboardingGate,
// which routes to the workspace.
const WelcomePage = () => {
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const [laneId, setLaneId] = useState(ALL_PACKS[0].id)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!accepted || submitting) return
    setSubmitting(true)
    setFailed(false)
    try {
      await completeOnboarding({ lane: laneId })
    } catch {
      setFailed(true)
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-5 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-[480px]">
        <p className="text-[26px] font-semibold tracking-[-.02em]">
          <BrandName />
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-3">
          Invited testing · one thing before you start
        </p>

        <fieldset className="mt-8">
          <legend className="text-[20px] font-semibold leading-[1.2] tracking-[-.015em]">
            What are you here to prepare for?
          </legend>
          <div className="mt-4 space-y-2.5">
            {ALL_PACKS.map((lane) => (
              <label
                key={lane.id}
                className={cn(
                  "block cursor-pointer rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-blue",
                  laneId === lane.id
                    ? "border-accent-line bg-accent-bg"
                    : "border-line-2 bg-surface-raised shadow-card hover:bg-surface-2"
                )}
              >
                <input
                  type="radio"
                  name="lane"
                  value={lane.id}
                  checked={laneId === lane.id}
                  onChange={() => setLaneId(lane.id)}
                  className="sr-only"
                />
                <span className="block text-[15.5px] font-semibold tracking-[-.01em]">
                  {lane.label}
                </span>
                <span className="mt-1 block text-[13px] leading-[1.5] text-on-surface-2">
                  {lane.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-7 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="focus-ring mt-[3px] size-4 flex-none accent-[var(--accent-blue)]"
          />
          <span className="text-[13px] leading-[1.55] text-on-surface-2">
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="focus-ring underline hover:text-accent-blue"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="focus-ring underline hover:text-accent-blue"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Disclosure className="mt-4" />

        <button
          type="submit"
          disabled={!accepted || submitting}
          className="focus-ring mt-6 w-full rounded-[10px] bg-accent-blue px-4 py-3 text-[13.5px] font-medium text-primary-foreground shadow-btn transition hover:bg-accent-blue-hover active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Enter Prestage AI →"}
        </button>
        {failed && (
          <p role="alert" className="mt-3 text-[13px] text-red-fg">
            That didn&apos;t go through. Check your connection and try again.
          </p>
        )}
      </form>
    </main>
  )
}

export default WelcomePage
