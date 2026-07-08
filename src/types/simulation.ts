export type SimulationStatus = 'draft' | 'analyzing' | 'ready' | 'live' | 'complete'

export type Brief = {
  ideaName: string
  stage: string
  description: string
  targetUser: string
  businessModel: string
  focusAreas: string[]
}

export type SimulationContext = {
  problem: string
  targetCustomer: string
  coreAssumption: string
  revenueModel: string
  primaryRisk: string
  competitors: string
  openQuestions: string
}

export const CONTEXT_FIELDS: { key: keyof SimulationContext; label: string }[] = [
  { key: 'problem', label: 'Problem' },
  { key: 'targetCustomer', label: 'Target customer' },
  { key: 'coreAssumption', label: 'Core assumption' },
  { key: 'revenueModel', label: 'Revenue model' },
  { key: 'primaryRisk', label: 'Primary risk' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'openQuestions', label: 'Open questions' },
]

export type Simulation = {
  _id: string
  _creationTime: number
  title: string
  roomType: string
  status: SimulationStatus
  brief: Brief
  context?: SimulationContext
  version: number
}
