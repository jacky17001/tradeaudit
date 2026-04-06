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
}
