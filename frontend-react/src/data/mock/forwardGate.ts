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
}
