export type ForwardRunStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'

export type GateDecision = 'PASS' | 'PROMISING' | 'NEEDS_IMPROVEMENT' | 'FAIL' | 'REJECT'

export type ForwardRunSummary = {
  id: number
  forwardRunId: number
  totalTrades: number
  winRate: number
  pnl: number
  maxDrawdown: number
  expectancy: number
  periodStart: string | null
  periodEnd: string | null
  lastUpdatedAt: string
  createdAt: string
}

export type ForwardRunItem = {
  id: number
  strategyId: string
  strategyName: string
  sourceJobId: number | null
  symbol: string
  timeframe: string
  status: ForwardRunStatus
  note: string
  startedAt: string
  endedAt: string | null
  createdAt: string
  updatedAt: string
  summary?: ForwardRunSummary | null
  gateResult?: ForwardRunGateResult | null
}

export type ForwardRunsListResponse = {
  items: ForwardRunItem[]
  total: number
  page: number
  pageSize: number
}

export type CreateForwardRunPayload = {
  strategyId: string
  symbol: string
  timeframe: string
  note?: string
}

export type SaveForwardRunSummaryPayload = {
  totalTrades: number
  winRate: number
  pnl: number
  maxDrawdown: number
  expectancy: number
  periodStart?: string | null
  periodEnd?: string | null
}

export type ForwardRunGateResult = {
  id: number
  forwardRunId: number
  gateDecision: GateDecision
  confidence: string | null
  hardFail: boolean
  sampleAdequacy: string | null
  strongestFactor: string | null
  weakestFactor: string | null
  notes: string
  evaluatedAt: string
  createdAt: string
  updatedAt: string
}

export type SaveForwardRunGateResultPayload = {
  gateDecision: GateDecision
  confidence?: string | null
  hardFail?: boolean
  sampleAdequacy?: string | null
  strongestFactor?: string | null
  weakestFactor?: string | null
  notes?: string
  evaluatedAt?: string | null
}

export type GateResultsListItem = ForwardRunGateResult & {
  strategyId: string
  strategyName: string
  symbol: string
  timeframe: string
  forwardStatus: ForwardRunStatus
}

export type GateResultsListResponse = {
  items: GateResultsListItem[]
  total: number
  page: number
  pageSize: number
}
