import Link from "next/link"

export const IdeaNotFound = () => (
  <p className="text-[13.5px] text-on-surface-2">
    This idea doesn&apos;t exist.{" "}
    <Link href="/simulation/new" className="focus-ring underline hover:text-red-fg">
      Start a new stress test
    </Link>
    .
  </p>
)
