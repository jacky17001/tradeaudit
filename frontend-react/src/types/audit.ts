import type { EvaluationResult } from './evaluation'

export type AuditOverviewItem = {
  label: string
  value: string
}

export type AuditRiskSignal = {
  label: string
  value: string
}

export type AuditPayload = {
  accountName: string
  broker: string
  balance: number
  equity: number
  riskScore: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  overview: AuditOverviewItem[]
  riskSignals: AuditRiskSignal[]
  aiExplanation: string
  finalScore: EvaluationResult['finalScore']
  scoreBreakdown: EvaluationResult['scoreBreakdown']
  decision: EvaluationResult['decision']
  decisionReason: EvaluationResult['decisionReason']
  recommendedAction: EvaluationResult['recommendedAction']
  explanation: EvaluationResult['explanation']
  hardFailTriggered?: EvaluationResult['hardFailTriggered']
  hardFailReasons?: EvaluationResult['hardFailReasons']
  strongestFactor?: EvaluationResult['strongestFactor']
  weakestFactor?: EvaluationResult['weakestFactor']
  confidenceLevel?: EvaluationResult['confidenceLevel']
  sampleAdequacy?: EvaluationResult['sampleAdequacy']
  dataSourceType?: EvaluationResult['dataSourceType']
  evaluatedAt?: EvaluationResult['evaluatedAt']
  rulesVersion?: EvaluationResult['rulesVersion']
  datasetVersion?: EvaluationResult['datasetVersion']
  previousScore?: EvaluationResult['previousScore']
  scoreDelta?: EvaluationResult['scoreDelta']
  previousDecision?: EvaluationResult['previousDecision']
  decisionChanged?: EvaluationResult['decisionChanged']
}

export type AuditSummaryResponse = {
  accountName: string
  broker: string
  balance: number
  equity: number
  riskScore: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  aiExplanation: string
  finalScore: EvaluationResult['finalScore']
  scoreBreakdown: EvaluationResult['scoreBreakdown']
  decision: EvaluationResult['decision']
  decisionReason: EvaluationResult['decisionReason']
  recommendedAction: EvaluationResult['recommendedAction']
  explanation: EvaluationResult['explanation']
  hardFailTriggered?: EvaluationResult['hardFailTriggered']
  hardFailReasons?: EvaluationResult['hardFailReasons']
  strongestFactor?: EvaluationResult['strongestFactor']
  weakestFactor?: EvaluationResult['weakestFactor']
  confidenceLevel?: EvaluationResult['confidenceLevel']
  sampleAdequacy?: EvaluationResult['sampleAdequacy']
  dataSourceType?: EvaluationResult['dataSourceType']
  evaluatedAt?: EvaluationResult['evaluatedAt']
  rulesVersion?: EvaluationResult['rulesVersion']
  datasetVersion?: EvaluationResult['datasetVersion']
  previousScore?: EvaluationResult['previousScore']
  scoreDelta?: EvaluationResult['scoreDelta']
  previousDecision?: EvaluationResult['previousDecision']
  decisionChanged?: EvaluationResult['decisionChanged']
}
