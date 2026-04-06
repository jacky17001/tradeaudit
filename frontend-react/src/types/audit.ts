export type AuditOverviewItem = {
  label: string
  value: string
}

export type AuditRiskSignal = {
  label: string
  value: string
}

export type AuditPayload = {
  accountName: string
  broker: string
  balance: number
  equity: number
  riskScore: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  overview: AuditOverviewItem[]
  riskSignals: AuditRiskSignal[]
  aiExplanation: string
}

export type AuditSummaryResponse = {
  accountName: string
  broker: string
  balance: number
  equity: number
  riskScore: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  aiExplanation: string
}
