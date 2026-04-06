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
  finalScore: 71,
  scoreBreakdown: {
    riskScore: 28,
    maxDrawdown: 20,
    winRate: 15,
    profitFactor: 8,
  },
  decision: 'PASS',
  decisionReason: 'All account quality gates satisfied',
  recommendedAction: 'Maintain current risk protocol and continue monitored execution.',
  explanation:
    'Account evaluation PASS with final score 71/100. Risk profile is acceptable for current stage, with further upside from tighter discipline in volatile sessions.',
}
