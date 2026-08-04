"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Panel } from "@/components/shared/Panel"

// Deletion needs no navigation here: removing the users row flips the
// OnboardingGate, which routes to /welcome.
const SettingsPage = () => {
  const user = useQuery(api.users.getCurrent)
  const deleteAccount = useMutation(api.users.deleteAccount)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setFailed(false)
    try {
      await deleteAccount({})
    } catch {
      setFailed(true)
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-on-surface-2">
          Settings
        </p>
        <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-.02em]">
          Your account
        </h1>
      </div>

      <Panel title="Legal">
        <p className="text-[13.5px] leading-[1.6] text-on-surface-2">
          You accepted the{" "}
          <Link href="/terms" className="focus-ring underline hover:text-red-fg">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="focus-ring underline hover:text-red-fg">
            Privacy Policy
          </Link>
          {user
            ? ` (version ${user.termsVersion}) on ${new Date(user.termsAcceptedAt).toLocaleDateString()}.`
            : "."}
        </p>
      </Panel>

      <Panel title="Danger zone">
        <p className="text-[13.5px] leading-[1.6] text-on-surface-2">
          Deleting your account permanently removes your ideas, uploads, session transcripts,
          and reports. Your sign-in survives. Coming back starts you over at onboarding.
        </p>
        {confirming ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="focus-ring border border-red bg-red px-4 py-[10px] font-mono text-[11px] uppercase tracking-[.08em] text-white transition-colors hover:bg-red-deep disabled:pointer-events-none disabled:opacity-60"
            >
              {deleting ? "Deleting everything…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="focus-ring font-mono text-[11px] uppercase tracking-[.06em] text-on-surface-2 hover:text-on-surface"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="focus-ring mt-4 border border-red px-4 py-[10px] font-mono text-[11px] uppercase tracking-[.08em] text-red-fg transition-colors hover:bg-red hover:text-white"
          >
            Delete my account and data
          </button>
        )}
        {failed && (
          <p role="alert" className="mt-3 text-[13px] text-red-fg">
            Deletion didn&apos;t go through, so nothing was removed. Check your connection and
            try again.
          </p>
        )}
      </Panel>
    </div>
  )
}

export default SettingsPage
