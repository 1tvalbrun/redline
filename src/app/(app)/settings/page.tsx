"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { ALL_PACKS } from "@/domains/registry"
import { Panel } from "@/components/shared/Panel"

// Deletion needs no navigation here: removing the users row flips the
// OnboardingGate, which routes to /welcome.
const SettingsPage = () => {
  const user = useQuery(api.users.getCurrent)
  const deleteAccount = useMutation(api.users.deleteAccount)
  const addLane = useMutation(api.users.addLane)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [laneFailed, setLaneFailed] = useState(false)
  const [enablingLane, setEnablingLane] = useState<string | null>(null)

  const handleEnableLane = async (lane: string) => {
    if (enablingLane) return
    setEnablingLane(lane)
    setLaneFailed(false)
    try {
      await addLane({ lane })
    } catch {
      setLaneFailed(true)
    } finally {
      setEnablingLane(null)
    }
  }

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

      <Panel title="Practice lanes">
        <p className="text-[13.5px] leading-[1.6] text-on-surface-2">
          Every lane you enable shows up when you start a new run. Enabling a
          lane never touches your existing history.
        </p>
        <ul className="mt-4 space-y-2.5">
          {ALL_PACKS.map((pack) => {
            const enabled = user?.lanes.includes(pack.id) ?? false
            return (
              <li
                key={pack.id}
                className="flex items-center justify-between gap-4 border border-line-2 p-3.5"
              >
                <span>
                  <span className="block font-display text-[15px] font-bold tracking-[-.01em]">
                    {pack.label}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-on-surface-2">
                    {pack.description}
                  </span>
                </span>
                {enabled ? (
                  <span className="flex-none font-mono text-[10px] uppercase tracking-[.1em] text-ok">
                    Enabled
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEnableLane(pack.id)}
                    disabled={enablingLane !== null || user === undefined}
                    aria-label={`Enable ${pack.label}`}
                    className="focus-ring flex-none border border-line-2 px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[.08em] text-on-surface transition-colors hover:border-red hover:text-red-fg disabled:pointer-events-none disabled:opacity-60"
                  >
                    {enablingLane === pack.id ? "Enabling…" : "Enable"}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {laneFailed && (
          <p role="alert" className="mt-3 text-[13px] text-red-fg">
            Couldn&apos;t enable that lane. Check your connection and try again.
          </p>
        )}
      </Panel>

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
