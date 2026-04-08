export type OverviewEntry = {
  title: string
  score: number | null
  verdict: string
  riskLevel: string
  trustLevel: string
  recommendedNextStep: string
  refId: string | null
  strategyName?: string
  isCandidate?: boolean
}

export type ResultOverviewPayload = {
  strategyOverview: OverviewEntry
  accountOverview: OverviewEntry
}
