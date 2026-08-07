import { StubPage } from "@/components/workspace/StubPage"

const HelpPage = () => (
  <StubPage
    title="Help & docs"
    lead="How Redline works, how scoring is calculated, and how to get the most out of a run. Because a good tool shouldn't need a four-hour onboarding video."
    items={[
      { k: "START", title: "2-minute first run", description: "Everything you need to face the room today." },
      { k: "SCORING", title: "How readiness is scored", description: "What your lane's axes mean and how the ready line works." },
      { k: "CONTACT", title: "Talk to a human", description: "Real support, not a ticket black hole." },
    ]}
  />
)

export default HelpPage
