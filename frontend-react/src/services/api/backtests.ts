import { env } from '../../config/env'
import { backtestsMock } from '../../data/mock/backtests'
import { get, post } from '../../lib/http'
import type { BacktestsListResponse, BacktestsPayload } from '../../types/backtests'
import { endpoints } from '../endpoints'
import { mapBacktestsListToPayload } from '../mappers/backtestsMapper'

export type BacktestsImportResult = {
  mode: string
  importedCount: number
  skippedCount: number
  failedCount: number
  invalidRowCount: number
  validationErrors: string[]
  reEvaluatedCount: number
  snapshotWrittenCount: number
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
): Promise<BacktestsPayload> {
  if (env.useMockApi) {
    // Slice mock rows to simulate pagination
    const start = (page - 1) * pageSize
    const sliced = backtestsMock.rows.slice(start, start + pageSize)
    return { ...backtestsMock, rows: sliced, page, pageSize }
  }

  try {
    const url = `${endpoints.backtests.list}?page=${page}&pageSize=${pageSize}`
    const response = await get<BacktestsListResponse>(url)
    return mapBacktestsListToPayload(response)
  } catch {
    return backtestsMock
  }
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
