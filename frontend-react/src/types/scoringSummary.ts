export type ScoringSummaryItem = {
  kind: 'strategy' | 'account'
  title: string
  score: number | null
  decision: string
  strongestFactor: string
  weakestFactor: string
  confidence: string
  dataAdequacy: string
  keyStrengths: string[]
  keyRisks: string[]
  explanation: string
  nextStep: string
  detailRef: string | null
  detailPath: string
}

export type CombinedScoringSummary = {
  strategy: ScoringSummaryItem
  account: ScoringSummaryItem
}
