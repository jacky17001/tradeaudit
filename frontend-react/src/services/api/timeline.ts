import { endpoints } from '../endpoints'
import { get } from '../../lib/http'

export interface TimelineEvent {
  event_type: string
  object_type: string
  object_ref_id: string | number
  title: string
  description?: string
  actor?: string
  created_at: string
  metadata?: Record<string, unknown>
  source_section: string
}

export interface TimelineResponse {
  object_type: string
  object_ref_id: string | number
  source_type?: string
  case_type?: string
  items: TimelineEvent[]
  count: number
}

export async function getCaseTimeline(caseId: number, limit: number = 50): Promise<TimelineResponse> {
  const url = `${endpoints.auditCases.timeline(caseId)}?limit=${limit}`
  return get<TimelineResponse>(url)
}

export async function getStrategyTimeline(strategyId: string, limit: number = 50): Promise<TimelineResponse> {
  const url = `${endpoints.backtests.timeline(strategyId)}?limit=${limit}`
  return get<TimelineResponse>(url)
}

export async function getAccountAuditTimeline(
  sourceType: string,
  sourceRefId: number,
  limit: number = 50,
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    sourceType,
    sourceRefId: String(sourceRefId),
    limit: String(limit),
  })
  const url = `${endpoints.audit.timeline}?${params.toString()}`
  return get<TimelineResponse>(url)
}
