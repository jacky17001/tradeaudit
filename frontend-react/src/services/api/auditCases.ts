import { endpoints } from '../endpoints'
import { env } from '../../config/env'
import { HttpError, get, post } from '../../lib/http'

export interface AuditCase {
  id: number
  case_type: string
  ref_id: number
  priority: string
  status: string
  note?: string
  created_at: string
  updated_at: string
  object_label?: string
}

export interface AuditCasesResponse {
  items: AuditCase[]
  total: number
  count: number
}

export interface ReviewQueueResponse {
  items: AuditCase[]
  count: number
  has_high_priority: boolean
}

export interface CaseSummary {
  total: number
  open: number
  in_progress: number
  closed: number
  on_watch: number
}

export async function listAuditCases(
  limit: number = 50,
  status?: string,
  priority?: string
): Promise<AuditCasesResponse> {
  const params = new URLSearchParams()
  params.append('limit', String(limit))
  if (status) params.append('status', status)
  if (priority) params.append('priority', priority)

  const url = `${endpoints.auditCases.list}?${params.toString()}`
  return get<AuditCasesResponse>(url)
}

export async function createAuditCase(data: {
  case_type: string
  ref_id: number
  priority?: string
  status?: string
  note?: string
}): Promise<AuditCase> {
  return post<AuditCase, typeof data>(endpoints.auditCases.create, data)
}

export async function getAuditCase(caseId: number): Promise<AuditCase> {
  return get<AuditCase>(endpoints.auditCases.detail(caseId))
}

export async function updateAuditCase(
  caseId: number,
  data: {
    priority?: string
    status?: string
    note?: string
  }
): Promise<AuditCase> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const path = endpoints.auditCases.update(caseId)
  const url = `${base}${path}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    let details: unknown
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    throw new HttpError(`HTTP ${response.status} for ${path}`, response.status, details)
  }

  return (await response.json()) as AuditCase
}

export async function getReviewQueue(limit: number = 50): Promise<ReviewQueueResponse> {
  const url = `${endpoints.auditCases.reviewQueue}?limit=${limit}`
  return get<ReviewQueueResponse>(url)
}

export async function getCaseSummary(): Promise<CaseSummary> {
  return get<CaseSummary>(endpoints.auditCases.summary)
}
