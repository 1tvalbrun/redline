import { StubPage } from "@/components/workspace/StubPage"

const SettingsPage = () => (
  <StubPage
    title="Settings"
    lead="Account, workspace, billing and panel defaults. Set the difficulty of the panel, choose which experts run by default, and manage how sessions are recorded and stored."
    items={[
      { k: "ACCOUNT", title: "Profile & team", description: "You, your co-founders, and who can see what." },
      { k: "PANEL", title: "Default difficulty", description: "How hard the panel pushes, out of the box." },
      { k: "BILLING", title: "Plan & usage", description: "Free first verdict, transparent pricing after, and no sales call." },
    ]}
  />
)

export default SettingsPage
