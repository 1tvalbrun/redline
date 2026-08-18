"use client"

import Link from "next/link"
import { LogoMark } from "@/components/shared/LogoMark"
import { BrandName } from "@/components/shared/BrandName"
import { SignInFlow } from "@/components/auth/SignInFlow"
import { cn } from "@/lib/utils"

const PANELISTS = [
  { role: "Pitch · the investor", quote: "“Walk me through the number you’re afraid of.”" },
  { role: "Sale · the buyer", quote: "“I’m fine with what we have. Change my mind.”" },
  { role: "Audit · the assessor", quote: "“Show me the control working, not the policy.”" },
  { role: "Interview · the interviewer", quote: "“Tell me about a time this went wrong.”" },
]

const SignInPage = () => (
  <main className="flex min-h-dvh flex-col bg-surface lg:flex-row">
    <section className="border-b border-line bg-surface-rail px-6 py-8 lg:flex-1 lg:border-b-0 lg:border-r lg:px-16 lg:py-12">
      <div className="flex h-full w-full flex-col justify-between gap-10 lg:mx-auto lg:max-w-[880px]">
      <p className="flex items-center gap-2">
        <LogoMark size="sm" />
        <span className="text-[15px] font-semibold tracking-[-.01em]">
          <BrandName />
        </span>
      </p>

      <div className="flex flex-col gap-6">
        <p className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red animate-pulse-red" />
          <span className="font-mono text-[11px] uppercase tracking-[.09em] text-on-surface-2">
            The room is live
          </span>
        </p>
        <h1 className="max-w-[720px] text-[34px] font-semibold leading-[1.08] tracking-[-.02em] lg:text-[48px]">
          Face the panel before the stage.
        </h1>
        <p className="max-w-[600px] text-[15.5px] leading-[1.5] text-on-surface-2">
          Run the room live against an AI panel that pushes back. Walk out knowing what went
          well, what did not, and what to do next.
        </p>

        <ul className="flex flex-col gap-2.5">
          {PANELISTS.map((panelist, i) => (
            <li
              key={panelist.role}
              className={cn(
                "items-center gap-4 rounded-[14px] border border-line bg-surface p-4",
                i === 0 ? "flex" : "hidden lg:flex"
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 flex-none place-items-center rounded-full bg-surface-2 font-mono text-[11px] font-medium tracking-[.06em] text-on-surface-2"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-[.09em] text-on-surface-3">
                  {panelist.role}
                </span>
                <span className="font-serif text-[15px] italic leading-[1.4]">
                  {panelist.quote}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] uppercase tracking-[.09em] text-ink-4 lg:hidden">
          Pitch · Sale · Audit · Interview
        </p>
      </div>

      <p className="hidden font-mono text-[10px] uppercase tracking-[.09em] text-ink-4 lg:block">
        Prestage AI · a live panel stress test · invited testing
      </p>
      </div>
    </section>

    <section className="flex flex-col items-center justify-center gap-7 px-6 py-10 lg:w-[440px] lg:flex-none lg:px-10 lg:py-12 xl:w-[480px]">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-7">
        <SignInFlow />
        <p className="flex gap-5">
          <Link
            href="/terms"
            className="focus-ring font-mono text-[10px] uppercase tracking-[.09em] text-on-surface-3 hover:text-on-surface-2"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="focus-ring font-mono text-[10px] uppercase tracking-[.09em] text-on-surface-3 hover:text-on-surface-2"
          >
            Privacy
          </Link>
        </p>
      </div>
    </section>
  </main>
)

export default SignInPage
