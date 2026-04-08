import { get, post } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { CreateReportSnapshotPayload, ReportSnapshot, ReportSnapshotListResponse } from '../../types/reportSnapshots'

export async function createReportSnapshot(payload: CreateReportSnapshotPayload): Promise<ReportSnapshot> {
  return post<ReportSnapshot, CreateReportSnapshotPayload>(endpoints.reportSnapshots.create, payload)
}

export async function getReportSnapshots(params?: {
  snapshotType?: string
  objectType?: string
  objectRefId?: number
  limit?: number
}): Promise<ReportSnapshotListResponse> {
  const qs = new URLSearchParams()
  if (params?.snapshotType) qs.append('snapshotType', params.snapshotType)
  if (params?.objectType) qs.append('objectType', params.objectType)
  if (typeof params?.objectRefId === 'number') qs.append('objectRefId', String(params.objectRefId))
  if (typeof params?.limit === 'number') qs.append('limit', String(params.limit))

  const q = qs.toString()
  const url = q ? `${endpoints.reportSnapshots.list}?${q}` : endpoints.reportSnapshots.list
  return get<ReportSnapshotListResponse>(url)
}

export async function getReportSnapshotDetail(snapshotId: number): Promise<ReportSnapshot> {
  return get<ReportSnapshot>(endpoints.reportSnapshots.detail(snapshotId))
}
