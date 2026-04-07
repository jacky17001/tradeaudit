import { env } from '../../config/env'
import { backtestsMock } from '../../data/mock/backtests'
import { get, post, HttpError } from '../../lib/http'
import type { BacktestsListResponse, BacktestsPayload, StrategyLifecycleResponse } from '../../types/backtests'
import { endpoints } from '../endpoints'
import { mapBacktestsListToPayload } from '../mappers/backtestsMapper'

export type DecisionChange = {
  id: string
  name: string
  oldDecision: string
  newDecision: string
}

export type ScoreDelta = {
  id: string
  name: string
  delta: number
}

export type ChangesSummary = {
  totalStrategiesBefore: number
  totalStrategiesAfter: number
  newStrategiesCount: number
  removedStrategiesCount: number
  changedStrategiesCount: number
  decisionChangedCount: number
  decisionChanges: DecisionChange[]
  biggestScoreIncrease: ScoreDelta | null
  biggestScoreDecrease: ScoreDelta | null
}

export type BacktestsImportResult = {
  mode: string
  importedCount: number
  skippedCount: number
  failedCount: number
  invalidRowCount: number
  validationErrors: string[]
  reEvaluatedCount: number
  snapshotWrittenCount: number
  changesSummary?: ChangesSummary
  jobId?: number
}

export type ChangeItem = {
  id: number
  importJobId: number
  strategyId: string
  strategyName: string
  changeType: 'NEW' | 'REMOVED' | 'UPDATED'
  beforeScore: number | null
  afterScore: number | null
  scoreDelta: number | null
  beforeDecision: string | null
  afterDecision: string | null
  createdAt: string
}

export type ImportJobChangesResponse = {
  jobId: number
  items: ChangeItem[]
  total: number
  limit: number
  offset: number
}

export type ImportJobItem = {
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

type ImportJobsResponse = {
  items: ImportJobItem[]
}

export async function getBacktestsData(
  page = 1,
  pageSize = 10,
  candidateOnly = false,
): Promise<BacktestsPayload> {
  if (env.useMockApi) {
    const sourceRows = candidateOnly
      ? backtestsMock.rows.filter((row) => row.isCandidate)
      : backtestsMock.rows
    const start = (page - 1) * pageSize
    const sliced = sourceRows.slice(start, start + pageSize)
    return { ...backtestsMock, rows: sliced, page, pageSize, total: sourceRows.length }
  }

  try {
    const url = `${endpoints.backtests.list}?page=${page}&pageSize=${pageSize}&candidateOnly=${candidateOnly}`
    const response = await get<BacktestsListResponse>(url)
    return mapBacktestsListToPayload(response)
  } catch {
    return backtestsMock
  }
}

export type CandidateToggleResult = {
  ok: boolean
  strategyId: string
  isCandidate: boolean
}

export function markBacktestCandidate(strategyId: string): Promise<CandidateToggleResult> {
  return post<CandidateToggleResult, Record<string, never>>(endpoints.backtests.candidate(strategyId), {})
}

export async function unmarkBacktestCandidate(strategyId: string): Promise<CandidateToggleResult> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const url = `${base}${endpoints.backtests.candidate(strategyId)}`
  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok) {
    let details: unknown
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    throw new HttpError(
      `HTTP ${response.status} for ${endpoints.backtests.candidate(strategyId)}`,
      response.status,
      details,
    )
  }
  return (await response.json()) as CandidateToggleResult
}

export function importBacktestsCsv(filePath: string, mode: 'replace' = 'replace') {
  return post<BacktestsImportResult, { filePath: string; mode: 'replace' }>(
    endpoints.backtests.import,
    { filePath, mode },
  )
}

export async function getRecentImportJobs(limit = 5): Promise<ImportJobItem[]> {
  if (env.useMockApi) {
    return []
  }

  try {
    const response = await get<ImportJobsResponse>(`${endpoints.importJobs.list}?limit=${limit}`)
    return response.items ?? []
  } catch {
    return []
  }
}

export async function importBacktestsCsvUpload(file: File): Promise<BacktestsImportResult> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const url = `${base}${endpoints.backtests.importUpload}`
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(url, { method: 'POST', body: formData })
  if (!response.ok) {
    let details: unknown
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    throw new HttpError(
      `HTTP ${response.status} for ${endpoints.backtests.importUpload}`,
      response.status,
      details,
    )
  }
  return (await response.json()) as BacktestsImportResult
}

export async function getImportJobChanges(
  jobId: number,
  changeType?: string,
  limit = 200,
  offset = 0,
): Promise<ImportJobChangesResponse> {
  const params = new URLSearchParams()
  if (changeType) params.set('changeType', changeType)
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  const url = `${endpoints.importJobs.changes(jobId)}?${params.toString()}`
  return get<ImportJobChangesResponse>(url)
}

export type ActiveDatasetInfo = {
  sourceJobId: number | null
  activatedAt?: string
  strategiesCount?: number
  sourcePath?: string
  mode?: string
  triggeredAt?: string | null
  isActivation?: boolean
}

export type ActivateResult = {
  ok: boolean
  jobId: number
  activatedAt: string
  strategiesCount: number
  activationDiffSummary?: {
    compared_from_job_id: number | null
    compared_to_job_id: number
    newStrategiesCount: number | null
    removedStrategiesCount: number | null
    changedStrategiesCount: number | null
    decisionChangedCount: number | null
    decisionUpgradeCount: number | null
    decisionDowngradeCount: number | null
    biggestScoreIncrease: ScoreDelta | null
    biggestScoreDecrease: ScoreDelta | null
  } | null
  message: string
}

export type CompareJobMeta = {
  jobId: number
  createdAt: string
  source: string
  mode: string
  status: string
  importSummary: {
    importedCount: number
    skippedCount: number
    failedCount: number
    invalidRowCount: number
    snapshotWrittenCount: number
    reEvaluatedCount: number
  }
}

export type CompareTopChangedStrategy = {
  strategyId: string
  strategyName: string
  leftScore: number | null
  rightScore: number | null
  delta: number | null
  leftDecision: string | null
  rightDecision: string | null
  changeType: 'NEW' | 'REMOVED' | 'UPDATED'
}

export type ImportJobsCompareResponse = {
  leftJob: CompareJobMeta
  rightJob: CompareJobMeta
  totalStrategiesLeft: number
  totalStrategiesRight: number
  newStrategiesCount: number
  removedStrategiesCount: number
  changedStrategiesCount: number
  decisionChangedCount: number
  decisionUpgradeCount: number
  decisionDowngradeCount: number
  biggestScoreIncrease: ScoreDelta | null
  biggestScoreDecrease: ScoreDelta | null
  decisionDistribution: {
    left: Record<string, number>
    right: Record<string, number>
  }
  topChangedStrategies: CompareTopChangedStrategy[]
}

export async function getActiveDataset(): Promise<ActiveDatasetInfo> {
  if (env.useMockApi) {
    return { sourceJobId: null }
  }
  try {
    return await get<ActiveDatasetInfo>(endpoints.backtestsActiveDataset)
  } catch {
    return { sourceJobId: null }
  }
}

export async function getStrategyLifecycle(strategyId: string): Promise<StrategyLifecycleResponse> {
  if (env.useMockApi) {
    const row = backtestsMock.rows.find((item) => item.id === strategyId)
    if (!row) {
      throw new Error(`Unknown strategy ${strategyId}`)
    }

    return {
      strategyId: row.id,
      strategyName: row.name,
      backtest: {
        ...row,
        rawScore: row.score,
        rawDecision: row.decision,
        isInActiveDataset: true,
      },
      candidate: {
        isCandidate: Boolean(row.isCandidate),
      },
      sourceJobId: null,
      sourceJob: null,
      latestForwardRun: null,
      latestSummary: null,
      latestGateResult: null,
    }
  }

  return get<StrategyLifecycleResponse>(endpoints.backtests.lifecycle(strategyId))
}

export function activateImportJob(jobId: number): Promise<ActivateResult> {
  return post<ActivateResult, Record<string, never>>(endpoints.importJobs.activate(jobId), {})
}

export async function compareImportJobs(
  leftJobId: number,
  rightJobId: number,
): Promise<ImportJobsCompareResponse> {
  const params = new URLSearchParams()
  params.set('leftJobId', String(leftJobId))
  params.set('rightJobId', String(rightJobId))
  return get<ImportJobsCompareResponse>(`${endpoints.importJobs.compare}?${params.toString()}`)
}
