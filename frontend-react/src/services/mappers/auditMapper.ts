import { auditMock } from '../../data/mock/audit'
import type { AuditPayload, AuditSummaryResponse } from '../../types/audit'

export function mapAuditSummaryToPayload(summary: AuditSummaryResponse): AuditPayload {
  return {
    accountName: summary.accountName,
    broker: summary.broker,
    balance: summary.balance,
    equity: summary.equity,
    riskScore: summary.riskScore,
    maxDrawdown: summary.maxDrawdown,
    winRate: summary.winRate,
    profitFactor: summary.profitFactor,
    aiExplanation: summary.aiExplanation,
    finalScore: summary.finalScore,
    scoreBreakdown: summary.scoreBreakdown,
    decision: summary.decision,
    decisionReason: summary.decisionReason,
    recommendedAction: summary.recommendedAction,
    explanation: summary.explanation,
    hardFailTriggered: summary.hardFailTriggered,
    hardFailReasons: summary.hardFailReasons,
    strongestFactor: summary.strongestFactor,
    weakestFactor: summary.weakestFactor,
    confidenceLevel: summary.confidenceLevel,
    sampleAdequacy: summary.sampleAdequacy,
    dataSourceType: summary.dataSourceType,
    evaluatedAt: summary.evaluatedAt,
    rulesVersion: summary.rulesVersion,
    datasetVersion: summary.datasetVersion,
    previousScore: summary.previousScore,
    scoreDelta: summary.scoreDelta,
    previousDecision: summary.previousDecision,
    decisionChanged: summary.decisionChanged,
    // Derived display fields — keep shape compatible with legacy mock consumers
    overview: [
      { label: 'Account Name', value: summary.accountName },
      { label: 'Broker', value: summary.broker },
      { label: 'Risk Score', value: `${summary.riskScore} / 100` },
    ],
    riskSignals: auditMock.riskSignals,
  }
}
