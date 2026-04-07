import { env } from '../../config/env'
import { HttpError, get, post } from '../../lib/http'
import type {
  CreateForwardRunPayload,
  GateDecision,
  GateResultsListResponse,
  ForwardRunItem,
  ForwardRunGateResult,
  ForwardRunsListResponse,
  ForwardRunSummary,
  ForwardRunStatus,
  SaveForwardRunGateResultPayload,
  SaveForwardRunSummaryPayload,
} from '../../types/forwardRuns'
import { endpoints } from '../endpoints'

export function createForwardRun(payload: CreateForwardRunPayload): Promise<ForwardRunItem> {
  return post<ForwardRunItem, CreateForwardRunPayload>(endpoints.forwardRuns.list, payload)
}

export async function getForwardRuns(
  status: 'ALL' | ForwardRunStatus,
  page = 1,
  pageSize = 10,
): Promise<ForwardRunsListResponse> {
  if (env.useMockApi) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    }
  }

  const params = new URLSearchParams()
  if (status !== 'ALL') {
    params.set('status', status)
  }
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  return get<ForwardRunsListResponse>(`${endpoints.forwardRuns.list}?${params.toString()}`)
}

export async function updateForwardRunStatus(runId: number, status: ForwardRunStatus): Promise<ForwardRunItem> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const path = endpoints.forwardRuns.updateStatus(runId)
  const url = `${base}${path}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
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

  return (await response.json()) as ForwardRunItem
}

export async function getForwardRunSummary(runId: number): Promise<ForwardRunSummary | null> {
  const response = await get<ForwardRunSummary | { forwardRunId: number; summary: null }>(
    `${endpoints.forwardRuns.list}/${runId}/summary`,
  )
  if (response && typeof response === 'object' && 'summary' in response) {
    return null
  }
  return response as ForwardRunSummary
}

export function saveForwardRunSummary(
  runId: number,
  payload: SaveForwardRunSummaryPayload,
): Promise<ForwardRunSummary> {
  return post<ForwardRunSummary, SaveForwardRunSummaryPayload>(
    `${endpoints.forwardRuns.list}/${runId}/summary`,
    payload,
  )
}

export async function getForwardRunGateResult(runId: number): Promise<ForwardRunGateResult | null> {
  const response = await get<ForwardRunGateResult | { forwardRunId: number; gateResult: null }>(
    endpoints.forwardRuns.gateResult(runId),
  )
  if (response && typeof response === 'object' && 'gateResult' in response) {
    return null
  }
  return response as ForwardRunGateResult
}

export function saveForwardRunGateResult(
  runId: number,
  payload: SaveForwardRunGateResultPayload,
): Promise<ForwardRunGateResult> {
  return post<ForwardRunGateResult, SaveForwardRunGateResultPayload>(
    endpoints.forwardRuns.gateResult(runId),
    payload,
  )
}

export async function getGateResults(
  decision: 'ALL' | GateDecision,
  page = 1,
  pageSize = 10,
): Promise<GateResultsListResponse> {
  const params = new URLSearchParams()
  if (decision !== 'ALL') {
    params.set('decision', decision)
  }
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return get<GateResultsListResponse>(`${endpoints.gateResults.list}?${params.toString()}`)
}
