import { env } from '../../config/env'
import { backtestsMock } from '../../data/mock/backtests'
import { get } from '../../lib/http'
import type { BacktestsListResponse, BacktestsPayload } from '../../types/backtests'
import { endpoints } from '../endpoints'
import { mapBacktestsListToPayload } from '../mappers/backtestsMapper'

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
