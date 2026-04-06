import type { ForwardGatePayload, ForwardGateSummaryResponse } from '../../types/forwardGate'

export function mapForwardGateSummaryToPayload(
  response: ForwardGateSummaryResponse,
): ForwardGatePayload {
  return {
    strategyName: response.strategyName,
    symbol: response.symbol,
    forwardStatus: response.forwardStatus,
    gateDecision: response.gateDecision,
    lastUpdated: response.lastUpdated,
    tradesObserved: response.tradesObserved,
    passRate: response.passRate,
    maxDrawdown: response.maxDrawdown,
    summary: response.summary,
    finalScore: response.finalScore,
    scoreBreakdown: response.scoreBreakdown,
    decision: response.decision,
    decisionReason: response.decisionReason,
    recommendedAction: response.recommendedAction,
    explanation: response.explanation,
    hardFailTriggered: response.hardFailTriggered,
    hardFailReasons: response.hardFailReasons,
    strongestFactor: response.strongestFactor,
    weakestFactor: response.weakestFactor,
    confidenceLevel: response.confidenceLevel,
    sampleAdequacy: response.sampleAdequacy,
    dataSourceType: response.dataSourceType,
    evaluatedAt: response.evaluatedAt,
    rulesVersion: response.rulesVersion,
    datasetVersion: response.datasetVersion,
    previousScore: response.previousScore,
    scoreDelta: response.scoreDelta,
    previousDecision: response.previousDecision,
    decisionChanged: response.decisionChanged,
  }
}
