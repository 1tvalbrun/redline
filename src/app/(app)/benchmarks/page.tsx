import { StubPage } from "@/components/workspace/StubPage"

const BenchmarksPage = () => (
  <StubPage
    title="Benchmarks"
    lead="How your readiness compares against your own past runs and against anonymized ideas at the same stage. See which axis founders like you most often fail, and where you're ahead."
    items={[
      { k: "TREND", title: "Your trajectory", description: "Readiness across every run, per idea, over time." },
      { k: "COHORT", title: "Versus your stage", description: "Anonymized: where pre-seed ideas usually break." },
      { k: "PATTERN", title: "Recurring weak spots", description: "The axis that keeps dragging your score down." },
    ]}
  />
)

export default BenchmarksPage
