import type { AuditPayload } from '../../types/audit'

export const auditMock: AuditPayload = {
  accountName: 'Demo Account',
  broker: 'Vantage Demo',
  balance: 10000,
  equity: 9875,
  riskScore: 68,
  maxDrawdown: 8.7,
  winRate: 55,
  profitFactor: 1.22,
  overview: [
    { label: 'Account Status', value: 'Connected (Demo)' },
    { label: 'Risk Score', value: '68 / 100' },
    { label: 'Behavior Grade', value: 'B+' },
  ],
  riskSignals: [
    { label: 'Max Drawdown', value: '8.7%' },
    { label: 'Stop Loss Violations', value: '1' },
    { label: 'Overtrading Risk', value: 'Low' },
  ],
  aiExplanation:
    'AI Explanation: Performance is stable with controlled drawdown. Trade exits are slightly early in volatile sessions, so discipline around target holding is recommended.',
}
