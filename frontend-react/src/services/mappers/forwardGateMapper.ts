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
  }
}
