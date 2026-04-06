export type BacktestRow = {
  id: string
  name: string
  symbol: string
  timeframe: string
  returnPct: number
  winRate: number
  maxDrawdown: number
  profitFactor: number
  score: number
  decision: string
}

export type BacktestsPayload = {
  rows: BacktestRow[]
  page: number
  pageSize: number
  total: number
}

export type BacktestsListResponse = {
  items: BacktestRow[]
  page: number
  pageSize: number
  total: number
}
