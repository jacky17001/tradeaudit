import type { EvaluationResult } from './evaluation'

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
  finalScore: EvaluationResult['finalScore']
  scoreBreakdown: EvaluationResult['scoreBreakdown']
  decision: EvaluationResult['decision']
  decisionReason: EvaluationResult['decisionReason']
  recommendedAction: EvaluationResult['recommendedAction']
  explanation: EvaluationResult['explanation']
  hardFailTriggered?: EvaluationResult['hardFailTriggered']
  hardFailReasons?: EvaluationResult['hardFailReasons']
  strongestFactor?: EvaluationResult['strongestFactor']
  weakestFactor?: EvaluationResult['weakestFactor']
  confidenceLevel?: EvaluationResult['confidenceLevel']
  sampleAdequacy?: EvaluationResult['sampleAdequacy']
  dataSourceType?: EvaluationResult['dataSourceType']
  evaluatedAt?: EvaluationResult['evaluatedAt']
  rulesVersion?: EvaluationResult['rulesVersion']
  datasetVersion?: EvaluationResult['datasetVersion']
  previousScore?: EvaluationResult['previousScore']
  scoreDelta?: EvaluationResult['scoreDelta']
  previousDecision?: EvaluationResult['previousDecision']
  decisionChanged?: EvaluationResult['decisionChanged']
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
  finalScore: EvaluationResult['finalScore']
  scoreBreakdown: EvaluationResult['scoreBreakdown']
  decision: EvaluationResult['decision']
  decisionReason: EvaluationResult['decisionReason']
  recommendedAction: EvaluationResult['recommendedAction']
  explanation: EvaluationResult['explanation']
  hardFailTriggered?: EvaluationResult['hardFailTriggered']
  hardFailReasons?: EvaluationResult['hardFailReasons']
  strongestFactor?: EvaluationResult['strongestFactor']
  weakestFactor?: EvaluationResult['weakestFactor']
  confidenceLevel?: EvaluationResult['confidenceLevel']
  sampleAdequacy?: EvaluationResult['sampleAdequacy']
  dataSourceType?: EvaluationResult['dataSourceType']
  evaluatedAt?: EvaluationResult['evaluatedAt']
  rulesVersion?: EvaluationResult['rulesVersion']
  datasetVersion?: EvaluationResult['datasetVersion']
  previousScore?: EvaluationResult['previousScore']
  scoreDelta?: EvaluationResult['scoreDelta']
  previousDecision?: EvaluationResult['previousDecision']
  decisionChanged?: EvaluationResult['decisionChanged']
}

export type AuditIntakeSourceType = 'STATEMENT' | 'ACCOUNT_HISTORY' | 'MANUAL'

export type AuditSummarySourceType =
  | 'mt5_investor'
  | 'statement_upload'
  | 'account_history_upload'
  | 'manual_trade_import'

export type AccountAuditSummaryItem = {
  id: number
  sourceType: AuditSummarySourceType
  sourceRefId: number
  accountLabel: string
  totalTrades: number | null
  winRate: number | null
  pnl: number | null
  maxDrawdown: number | null
  profitFactor: number | null
  expectancy: number | null
  averageHoldingTime: number | null
  periodStart: string | null
  periodEnd: string | null
  lastComputedAt: string
  createdAt: string
  updatedAt: string
}

export type AccountAuditSummariesResponse = {
  items: AccountAuditSummaryItem[]
}

export type RecomputeSummaryPayload = {
  sourceType: AuditSummarySourceType
  sourceRefId: number
}

export type AuditIntakeJob = {
  id: number
  sourceType: AuditIntakeSourceType
  intakeMethod: 'UPLOAD' | 'MANUAL'
  sourceLabel: string
  originalFilename: string
  detectedRows: number
  note: string
  status: 'SUCCESS' | 'FAILED'
  errorMessage: string
  createdAt: string
}

export type AuditIntakeJobsResponse = {
  items: AuditIntakeJob[]
}

export type CreateAuditManualIntakePayload = {
  sourceType: AuditIntakeSourceType
  manualText: string
  note?: string
}

export type CreateAuditUploadIntakePayload = {
  sourceType: Exclude<AuditIntakeSourceType, 'MANUAL'>
  file: File
  note?: string
}

export type Mt5TradeItem = {
  id: number
  ticket: string
  symbol: string
  orderType: string
  volume: number
  openTime: string | null
  closeTime: string | null
  profit: number
  commission: number
  swap: number
  comment: string
}

export type Mt5AccountInfo = {
  accountNumber: string
  server: string
  accountName: string
  currency: string
  balance: number
  equity: number
  leverage: number
}

export type Mt5ConnectionItem = {
  id: number
  accountNumber: string
  server: string
  connectionLabel: string
  status: string
  lastTestedAt: string | null
  lastSyncedAt: string | null
  errorMessage: string
  readOnlyAccess: boolean
  accountInfo: Mt5AccountInfo
  syncedTradeCount: number
  createdAt: string
  updatedAt: string
  readOnlyMessage?: string
  recentTrades?: Mt5TradeItem[]
  providerMode?: string
  message?: string
}

export type Mt5ConnectionsResponse = {
  items: Mt5ConnectionItem[]
}

export type Mt5TestConnectionResponse = {
  ok: boolean
  status: string
  readOnlyAccess: boolean
  tradingAllowed: boolean
  providerMode: string
  accountInfo: Mt5AccountInfo
  tradesPreview: Omit<Mt5TradeItem, 'id'>[]
  tradesCount: number
  message: string
}

export type TestMt5ConnectionPayload = {
  accountNumber: string
  server: string
  investorPassword: string
}

export type CreateMt5ConnectionPayload = TestMt5ConnectionPayload & {
  connectionLabel?: string
}

export type SyncMt5ConnectionPayload = {
  investorPassword?: string
}

export type AccountAuditReviewSourceInfo = {
  sourceType: AuditSummarySourceType
  sourceRefId: number
  sourceLabel: string
  accountNumber?: string
  server?: string
  status?: string
  lastTestedAt?: string | null
  lastSyncedAt?: string | null
  syncedTradeCount?: number
  intakeMethod?: string
  originalFilename?: string
  detectedRows?: number
  note?: string
  errorMessage?: string
  createdAt?: string
  readOnlyAccess?: boolean
}

export type AccountAuditReviewAccountInfo = {
  accountNumber: string
  server: string
  accountName: string
  currency: string
  balance: number
  equity: number
  leverage: number
}

export type AccountAuditReviewMetricsSummary = {
  id: number
  totalTrades: number | null
  winRate: number | null
  pnl: number | null
  maxDrawdown: number | null
  profitFactor: number | null
  expectancy: number | null
  averageHoldingTime: number | null
  periodStart: string | null
  periodEnd: string | null
  lastComputedAt: string
}

export type AccountAuditReviewDataCoverage = {
  hasSummary: boolean
  tradeCount: number
  coveredPeriod: {
    start: string | null
    end: string | null
  } | null
  lastSyncOrUpload: string | null
  completenessNote: string
}

export type AccountAuditReview = {
  sourceInfo: AccountAuditReviewSourceInfo
  accountInfo: AccountAuditReviewAccountInfo | null
  metricsSummary: AccountAuditReviewMetricsSummary | null
  recentTrades: Mt5TradeItem[]
  dataCoverage: AccountAuditReviewDataCoverage
}

