/**
 * Review Board API Service
 * Stage 48: API client for review board endpoints
 */
import { get } from '../../lib/http'
import type { ReviewBoardCasesResponse, ReviewBoardSummary, ReviewStatusOptions } from '../../types/reviewBoard'

export async function getReviewBoardSummary(): Promise<ReviewBoardSummary> {
  return get('/api/review-board/summary')
}

export async function getReviewBoardCases(
  limit?: number,
  offset?: number,
  status?: string | null,
  caseType?: string | null,
  priority?: string | null
): Promise<ReviewBoardCasesResponse> {
  const params = new URLSearchParams()
  if (limit) params.append('limit', limit.toString())
  if (offset) params.append('offset', offset.toString())
  if (status) params.append('status', status)
  if (caseType) params.append('caseType', caseType)
  if (priority) params.append('priority', priority)

  const queryString = params.toString()
  const url = queryString ? `/api/review-board/cases?${queryString}` : '/api/review-board/cases'

  return get(url)
}

export async function getReviewStatusOptions(): Promise<ReviewStatusOptions> {
  return get('/api/review-board/options')
}
