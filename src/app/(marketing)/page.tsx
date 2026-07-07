import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const MarketingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-foreground" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Redline
          </span>
        </Link>
        <Link href="/simulation/new">
          <Button size="sm" className="gap-2">
            Start simulation <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-8 pb-24 pt-12">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-muted-foreground tracking-wide">
            NOW IN PRIVATE BETA
          </span>
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">
            1,200 founders on the waitlist
          </span>
        </div>

        <h1 className="font-display text-6xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Stress-test your ideas
          <br />
          <span className="text-muted-foreground/70">before reality does.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Redline runs your idea through a live AI expert panel that challenges your
          assumptions, debates your moats, and ships a cinematic decision report —
          in 12 minutes, not 12 weeks.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/simulation/new">
            <Button size="lg" className="gap-2 text-base">
              Start a simulation <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/home">
            <Button size="lg" variant="ghost" className="gap-2 text-base">
              Watch a live room
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid max-w-3xl grid-cols-1 gap-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums">12 min</p>
            <p className="mt-1 text-sm text-muted-foreground">Avg. simulation</p>
          </div>
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums">8.4×</p>
            <p className="mt-1 text-sm text-muted-foreground">Sharper decisions</p>
          </div>
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums">$0</p>
            <p className="mt-1 text-sm text-muted-foreground">Until you ship a report</p>
          </div>
        </div>
      </main>

    </div>
  )
}

export default MarketingPage
