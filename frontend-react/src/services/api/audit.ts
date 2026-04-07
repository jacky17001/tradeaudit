import { env } from '../../config/env'
import { auditMock } from '../../data/mock/audit'
import { HttpError, get, post } from '../../lib/http'
import type {
  AccountAuditReview,
  AccountAuditSummariesResponse,
  AccountAuditSummaryItem,
  AuditIntakeJob,
  AuditIntakeJobsResponse,
  AuditPayload,
  AuditSummaryResponse,
  CreateAuditManualIntakePayload,
  CreateAuditUploadIntakePayload,
  CreateMt5ConnectionPayload,
  Mt5ConnectionItem,
  Mt5ConnectionsResponse,
  Mt5TestConnectionResponse,
  RecomputeSummaryPayload,
  SyncMt5ConnectionPayload,
  TestMt5ConnectionPayload,
} from '../../types/audit'
import { endpoints } from '../endpoints'
import { mapAuditSummaryToPayload } from '../mappers/auditMapper'

export async function getAuditData(): Promise<AuditPayload> {
  if (env.useMockApi) {
    return auditMock
  }

  try {
    const summary = await get<AuditSummaryResponse>(endpoints.audit.summary)
    return mapAuditSummaryToPayload(summary)
  } catch {
    return auditMock
  }
}

export async function getAuditIntakeJobs(limit = 5): Promise<AuditIntakeJob[]> {
  if (env.useMockApi) {
    return []
  }

  try {
    const response = await get<AuditIntakeJobsResponse>(`${endpoints.audit.intakeJobs}?limit=${limit}`)
    return response.items ?? []
  } catch {
    return []
  }
}

export function createAuditManualIntake(payload: CreateAuditManualIntakePayload): Promise<AuditIntakeJob> {
  if (env.useMockApi) {
    return Promise.resolve({
      id: Date.now(),
      sourceType: payload.sourceType,
      intakeMethod: 'MANUAL',
      sourceLabel: 'manual-trade-history',
      originalFilename: '',
      detectedRows: payload.manualText.split(/\r?\n/).filter((line) => line.trim()).length,
      note: payload.note ?? '',
      status: 'SUCCESS',
      errorMessage: '',
      createdAt: new Date().toISOString(),
    })
  }

  return post<AuditIntakeJob, CreateAuditManualIntakePayload>(endpoints.audit.intake, payload)
}

export async function createAuditUploadIntake(payload: CreateAuditUploadIntakePayload): Promise<AuditIntakeJob> {
  if (env.useMockApi) {
    return {
      id: Date.now(),
      sourceType: payload.sourceType,
      intakeMethod: 'UPLOAD',
      sourceLabel: payload.file.name,
      originalFilename: payload.file.name,
      detectedRows: 1,
      note: payload.note ?? '',
      status: 'SUCCESS',
      errorMessage: '',
      createdAt: new Date().toISOString(),
    }
  }

  const base = env.apiBaseUrl.replace(/\/$/, '')
  const url = `${base}${endpoints.audit.intakeUpload}`
  const formData = new FormData()
  formData.append('sourceType', payload.sourceType)
  formData.append('file', payload.file)
  if (payload.note) {
    formData.append('note', payload.note)
  }

  const response = await fetch(url, { method: 'POST', body: formData })
  if (!response.ok) {
    let details: unknown
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    throw new HttpError(`HTTP ${response.status} for ${endpoints.audit.intakeUpload}`, response.status, details)
  }

  return (await response.json()) as AuditIntakeJob
}

export async function testMt5Connection(payload: TestMt5ConnectionPayload): Promise<Mt5TestConnectionResponse> {
  if (env.useMockApi) {
    return {
      ok: true,
      status: 'SUCCESS',
      readOnlyAccess: true,
      tradingAllowed: false,
      providerMode: 'mock',
      accountInfo: {
        accountNumber: payload.accountNumber,
        server: payload.server,
        accountName: `Investor ${payload.accountNumber.slice(-4)}`,
        currency: 'USD',
        balance: 10234.5,
        equity: 9988.3,
        leverage: 200,
      },
      tradesPreview: [],
      tradesCount: 0,
      message: 'Read-only investor connection successful. This connection does not allow trading.',
    }
  }

  return post<Mt5TestConnectionResponse, TestMt5ConnectionPayload>(endpoints.audit.mt5TestConnection, payload)
}

export async function createMt5Connection(payload: CreateMt5ConnectionPayload): Promise<Mt5ConnectionItem> {
  if (env.useMockApi) {
    return {
      id: Date.now(),
      accountNumber: payload.accountNumber,
      server: payload.server,
      connectionLabel: payload.connectionLabel || `MT5 ${payload.accountNumber}@${payload.server}`,
      status: 'CONNECTED',
      lastTestedAt: new Date().toISOString(),
      lastSyncedAt: null,
      errorMessage: '',
      readOnlyAccess: true,
      accountInfo: {
        accountNumber: payload.accountNumber,
        server: payload.server,
        accountName: `Investor ${payload.accountNumber.slice(-4)}`,
        currency: 'USD',
        balance: 10234.5,
        equity: 9988.3,
        leverage: 200,
      },
      syncedTradeCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message: 'Read-only connection saved. This connection does not allow trading.',
    }
  }

  return post<Mt5ConnectionItem, CreateMt5ConnectionPayload>(endpoints.audit.mt5Connect, payload)
}

export async function getMt5Connections(limit = 10): Promise<Mt5ConnectionItem[]> {
  if (env.useMockApi) {
    return []
  }

  try {
    const response = await get<Mt5ConnectionsResponse>(`${endpoints.audit.mt5Connections}?limit=${limit}`)
    return response.items ?? []
  } catch {
    return []
  }
}

export function getMt5Connection(connectionId: number): Promise<Mt5ConnectionItem> {
  return get<Mt5ConnectionItem>(endpoints.audit.mt5Connection(connectionId))
}

export function syncMt5Connection(
  connectionId: number,
  payload: SyncMt5ConnectionPayload = {},
): Promise<Mt5ConnectionItem> {
  return post<Mt5ConnectionItem, SyncMt5ConnectionPayload>(endpoints.audit.mt5Sync(connectionId), payload)
}

export async function getAccountAuditSummaries(
  sourceType: string | null = null,
  limit = 20,
): Promise<AccountAuditSummaryItem[]> {
  if (env.useMockApi) {
    return []
  }

  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (sourceType) params.set('sourceType', sourceType)
    const response = await get<AccountAuditSummariesResponse>(
      `${endpoints.audit.summaries}?${params.toString()}`,
    )
    return response.items ?? []
  } catch {
    return []
  }
}

export function getAccountAuditSummaryDetail(summaryId: number): Promise<AccountAuditSummaryItem> {
  return get<AccountAuditSummaryItem>(endpoints.audit.summary(summaryId))
}

export function recomputeAccountAuditSummary(
  payload: RecomputeSummaryPayload,
): Promise<AccountAuditSummaryItem> {
  return post<AccountAuditSummaryItem, RecomputeSummaryPayload>(
    endpoints.audit.summariesRecompute,
    payload,
  )
}

export async function getAccountAuditReview(
  sourceType: string,
  sourceRefId: number,
): Promise<AccountAuditReview> {
  if (env.useMockApi) {
    return {
      sourceInfo: {
        sourceType: sourceType as any,
        sourceRefId,
        sourceLabel: `Review ${sourceType} ${sourceRefId}`,
      },
      accountInfo: null,
      metricsSummary: null,
      recentTrades: [],
      dataCoverage: {
        hasSummary: false,
        tradeCount: 0,
        coveredPeriod: null,
        lastSyncOrUpload: null,
        completenessNote: 'Mock data',
      },
    }
  }

  const params = new URLSearchParams()
  params.append('sourceType', sourceType)
  params.append('sourceRefId', sourceRefId.toString())

  try {
    return await get<AccountAuditReview>(`${endpoints.audit.review}?${params.toString()}`)
  } catch {
    return {
      sourceInfo: {
        sourceType: sourceType as any,
        sourceRefId,
        sourceLabel: `Review ${sourceType} ${sourceRefId}`,
      },
      accountInfo: null,
      metricsSummary: null,
      recentTrades: [],
      dataCoverage: {
        hasSummary: false,
        tradeCount: 0,
        coveredPeriod: null,
        lastSyncOrUpload: null,
        completenessNote: 'Unable to load review',
      },
    }
  }
}
