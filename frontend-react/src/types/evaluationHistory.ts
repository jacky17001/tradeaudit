export type EvaluationHistoryItem = {
  id: number
  entityType: string
  entityId: string
  finalScore: number
  decision: string
  explanation: string
  evaluatedAt: string
  rulesVersion: string
  datasetVersion: string
  confidenceLevel: string
  sampleAdequacy: string
  dataSourceType: string
}

export type EvaluationHistoryResponse = {
  entityType: string
  entityId: string
  items: EvaluationHistoryItem[]
}