export type RecommendedActionItem = {
  actionKey: string
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low' | string
  reason: string
  targetPath: string
}

export type RecommendedActionsPayload = {
  kind: 'strategy' | 'account'
  title: string
  score: number | null
  decision: string
  recommendedActions: RecommendedActionItem[]
}

export type RecommendedActionsCombined = {
  strategy: RecommendedActionsPayload
  account: RecommendedActionsPayload
}
