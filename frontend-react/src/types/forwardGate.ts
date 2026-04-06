import type { EvaluationResult } from './evaluation'

export type ForwardGatePayload = {
  strategyName: string
  symbol: string
  forwardStatus: string
  gateDecision: string
  lastUpdated: string
  tradesObserved: number
  passRate: number
  maxDrawdown: number
  summary: string
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

export type ForwardGateSummaryResponse = {
  strategyName: string
  symbol: string
  forwardStatus: string
  gateDecision: string
  lastUpdated: string
  tradesObserved: number
  passRate: number
  maxDrawdown: number
  summary: string
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
