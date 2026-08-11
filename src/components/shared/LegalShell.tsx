import Link from "next/link"
import { ReactNode } from "react"
import { LEGAL_ENTITY, TERMS_VERSION } from "@/lib/legal"

// Shared chrome for /terms and /privacy, the public pages readable signed out.
export const LegalShell = ({ title, children }: { title: string; children: ReactNode }) => (
  <main className="mx-auto w-full max-w-[680px] px-5 py-12">
    <Link href="/" className="focus-ring font-display text-[22px] font-bold tracking-[-.02em]">
      Prestage
    </Link>
    <h1 className="mt-8 font-display text-[32px] font-bold leading-[1.1] tracking-[-.02em]">
      {title}
    </h1>
    <p className="mt-2 font-mono text-[10px] uppercase tracking-[.14em] text-on-surface-2">
      Version {TERMS_VERSION} · {LEGAL_ENTITY}
    </p>
    <div className="mt-8 space-y-6 text-[14px] leading-[1.65] text-on-surface [&_h2]:font-display [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:tracking-[-.01em] [&_p]:mt-2 [&_p]:text-on-surface-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-on-surface-2">
      {children}
    </div>
  </main>
)
