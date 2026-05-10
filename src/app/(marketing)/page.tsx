import Link from "next/link"
import { Button } from "@/components/ui/button"

const MarketingPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-bold tracking-tight">
        Redline
      </h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        Stress-test your ideas against live AI expert panels. Get scored, challenged, and refined in real-time.
      </p>
      <Link href="/home">
        <Button size="lg">Enter Simulation</Button>
      </Link>
    </div>
  )
}

export default MarketingPage
