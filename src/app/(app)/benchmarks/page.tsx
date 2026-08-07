import { StubPage } from "@/components/workspace/StubPage"

const BenchmarksPage = () => (
  <StubPage
    title="Benchmarks"
    lead="How your readiness compares against your own past runs and against anonymized runs like yours. See which axis people in your lane most often fail, and where you're ahead."
    items={[
      { k: "TREND", title: "Your trajectory", description: "Readiness across every run, over time." },
      { k: "COHORT", title: "Versus your stage", description: "Anonymized: where runs like yours usually break." },
      { k: "PATTERN", title: "Recurring weak spots", description: "The axis that keeps dragging your score down." },
    ]}
  />
)

export default BenchmarksPage
