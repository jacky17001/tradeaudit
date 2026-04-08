export type FinalRecommendationKind = 'strategy' | 'account'

export type FinalRecommendationDecisionSnapshot = {
  source: string
  caseId: number | null
  caseType: string | null
  caseStatus: string | null
  latestAction: string | null
  decidedAt: string | null
  reviewedBy: string | null
}

export type FinalRecommendationPayload = {
  kind: FinalRecommendationKind
  finalRecommendation: 'Recommended' | 'Watchlist' | 'Needs More Data' | 'Not Recommended'
  finalStatus: string
  reviewerNote: string
  decisionSnapshot: FinalRecommendationDecisionSnapshot
  whyThisRecommendation: string
  supportingSignals: string[]
  recommendedNextStep: string | null
  detailRef: string | null
  detailPath: string | null
}

export type FinalRecommendationCombined = {
  strategy: FinalRecommendationPayload
  account: FinalRecommendationPayload
}
