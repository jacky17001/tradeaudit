import { env } from '../../config/env'
import { get } from '../../lib/http'
import type { EvaluationHistoryItem, EvaluationHistoryResponse } from '../../types/evaluationHistory'
import { endpoints } from '../endpoints'

export async function getEvaluationHistory(
  entityType: string,
  entityId: string,
  limit = 5,
): Promise<EvaluationHistoryItem[]> {
  if (!entityType || !entityId) {
    return []
  }

  if (env.useMockApi) {
    return []
  }

  try {
    const url = `${endpoints.evaluations.history}?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&limit=${limit}`
    const response = await get<EvaluationHistoryResponse>(url)
    return response.items ?? []
  } catch {
    return []
  }
}