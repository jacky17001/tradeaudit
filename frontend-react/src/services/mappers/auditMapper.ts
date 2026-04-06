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
    // Derived display fields — keep shape compatible with legacy mock consumers
    overview: [
      { label: 'Account Name', value: summary.accountName },
      { label: 'Broker', value: summary.broker },
      { label: 'Risk Score', value: `${summary.riskScore} / 100` },
    ],
    riskSignals: auditMock.riskSignals,
  }
}
