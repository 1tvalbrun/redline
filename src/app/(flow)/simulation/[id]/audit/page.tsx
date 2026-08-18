"use client"

import { use } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getPack } from "@/domains/registry"
import { FlowShell } from "@/components/simulation/flow/FlowShell"
import { AuditStage } from "@/components/simulation/intake/AuditStage"
import { BlueprintStage } from "@/components/simulation/intake/BlueprintStage"
import { IdeaNotFound } from "@/components/simulation/flow/IdeaNotFound"

// One route, two prep stages: the practice's pack declares whether its
// middle beat is the claims audit or the interview blueprint.
const PrepPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params)
  const practice = useQuery(api.practices.get, { id: id as Id<"practices"> })
  return (
    <FlowShell stage="audit" simulationId={id}>
      {practice === undefined ? null : practice === null ? (
        <IdeaNotFound />
      ) : getPack(practice.packId).prep.kind === "blueprint" ? (
        <BlueprintStage simulationId={id} />
      ) : (
        <AuditStage simulationId={id} />
      )}
    </FlowShell>
  )
}

export default PrepPage
