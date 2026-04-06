import type { ForwardGatePayload } from '../../types/forwardGate'

export const forwardGateMock: ForwardGatePayload = {
  strategyName: 'TrendFibPA_v7',
  symbol: 'XAUUSD',
  forwardStatus: 'RUNNING',
  gateDecision: 'PENDING',
  lastUpdated: '2026-04-06 18:30 UTC',
  tradesObserved: 18,
  passRate: 55,
  maxDrawdown: 6.8,
  summary:
    'Forward test consistency is acceptable, but low-liquidity session behavior requires additional review before gate approval.',
  finalScore: 59,
  scoreBreakdown: {
    forwardStatus: 20,
    sampleSize: 10,
    passRate: 14,
    maxDrawdown: 15,
  },
  decision: 'NEEDS_IMPROVEMENT',
  decisionReason: 'Forward validation is active but does not fully meet promotion thresholds',
  recommendedAction: 'Accumulate more forward samples and improve stability metrics.',
  explanation:
    'Forward evaluation NEEDS_IMPROVEMENT with final score 59/100. Runtime behavior is acceptable, but more sample depth is required for promotion confidence.',
}
