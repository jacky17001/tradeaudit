export type ComparisonSide = {
  id: string
  label: string
  score: number
  verdict: string
  riskLevel: string
  trustLevel: string
  recommendedNextStep: string
}

export type ComparisonMetric = {
  left: string | number | null
  right: string | number | null
  winner: 'left' | 'right' | 'close'
}

export type ComparisonReportPayload = {
  kind: 'strategy' | 'account'
  left: ComparisonSide
  right: ComparisonSide
  winner: 'left' | 'right' | 'close'
  recommendation: string
  summaryConclusion: string
  keyDifferences: string[]
  scoreComparison: {
    left: number
    right: number
    delta: number
    winner: 'left' | 'right' | 'close'
  }
  riskComparison: ComparisonMetric
  trustComparison: ComparisonMetric
  actionComparison: {
    left: string
    right: string
  }
  timelineHighlights?: {
    left: Array<{ title: string; description?: string; created_at?: string }>
    right: Array<{ title: string; description?: string; created_at?: string }>
  }
}
