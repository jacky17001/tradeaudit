import type { EvaluationResult } from './evaluation'
import type { ForwardRunGateResult, ForwardRunItem, ForwardRunSummary } from './forwardRuns'

export type BacktestRow = {
  id: string
  name: string
  isCandidate?: boolean
  symbol: string
  timeframe: string
  returnPct: number
  winRate: number
  maxDrawdown: number
  profitFactor: number
  tradeCount: number
  score: number
  finalScore: EvaluationResult['finalScore']
  scoreBreakdown: EvaluationResult['scoreBreakdown'] & {
    returnPct: number
    maxDrawdown: number
    profitFactor: number
    winRate: number
    tradeCount: number
  }
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

export type StrategyLifecycleSourceJob = {
  id: number
  jobType: string
  triggeredAt: string
  sourcePath: string
  mode: string
  importedCount: number
  skippedCount: number
  failedCount: number
  invalidRowCount: number
  reEvaluatedCount: number
  snapshotWrittenCount: number
  status: string
  errorMessage: string
}

export type StrategyLifecycleBacktest = BacktestRow & {
  rawScore: number
  rawDecision: string
  isInActiveDataset: boolean
}

export type StrategyLifecycleResponse = {
  strategyId: string
  strategyName: string
  backtest: StrategyLifecycleBacktest | null
  candidate: {
    isCandidate: boolean
  }
  sourceJobId: number | null
  sourceJob: StrategyLifecycleSourceJob | null
  latestForwardRun: ForwardRunItem | null
  latestSummary: ForwardRunSummary | null
  latestGateResult: ForwardRunGateResult | null
}
