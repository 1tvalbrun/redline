"use client"

import Link from "next/link"

// Render-time throws in the flow land here — most importantly a malformed
// practice id in the URL, which Convex's validator rejects inside useQuery
// before any component can branch on it. Without this boundary that's the
// framework's raw "Application error" screen.
const SimulationError = ({ reset }: { error: Error; reset: () => void }) => (
  <div className="flex min-h-screen items-center justify-center bg-surface p-8">
    <p className="text-[13.5px] text-on-surface-2">
      This practice doesn&apos;t exist, or the link is broken.{" "}
      <button
        type="button"
        onClick={reset}
        className="focus-ring underline hover:text-accent-blue"
      >
        Try again
      </button>{" "}
      or{" "}
      <Link href="/simulation/new" className="focus-ring underline hover:text-accent-blue">
        start a new practice
      </Link>
      .
    </p>
  </div>
)

export default SimulationError
