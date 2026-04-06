import type { BacktestsListResponse, BacktestsPayload } from '../../types/backtests'

export function mapBacktestsListToPayload(
  response: BacktestsListResponse,
): BacktestsPayload {
  return {
    rows: response.items,
    page: response.page,
    pageSize: response.pageSize,
    total: response.total,
  }
}
