export type EvaluationResult = {
  finalScore: number
  scoreBreakdown: Record<string, number>
  decision: string
  decisionReason: string
  recommendedAction: string
  explanation: string
  hardFailTriggered?: boolean
  hardFailReasons?: string[]
  strongestFactor?: string | null
  weakestFactor?: string | null
  confidenceLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | string
  sampleAdequacy?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | string
  dataSourceType?: string
  evaluatedAt?: string
  rulesVersion?: string
  datasetVersion?: string
  previousScore?: number | null
  scoreDelta?: number | null
  previousDecision?: string | null
  decisionChanged?: boolean | null
}