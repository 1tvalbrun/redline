import { StubPage } from "@/components/workspace/StubPage"

const MaterialsPage = () => (
  <StubPage
    title="Materials"
    lead="The documents the panel has read: decks, one-pagers, financials, and contracts. Not a data room; just a clear view of what Redline is grounding its questions in, and what's still missing. Add or swap a file and the gap map updates."
    items={[
      { k: "READ", title: "What the room sees", description: "Every uploaded file, with what Redline extracted from it." },
      { k: "MISSING", title: "The gap map", description: "What a real reviewer expects that you haven't provided yet." },
      { k: "SWAP", title: "Update and re-ground", description: "Replace a file; the next run reads the new version." },
    ]}
  />
)

export default MaterialsPage
