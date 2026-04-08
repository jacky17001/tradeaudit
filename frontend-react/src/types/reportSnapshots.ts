export interface ReportSnapshot {
  id: number
  snapshot_type: 'audit_report' | 'comparison_report' | 'final_recommendation'
  object_type: 'strategy' | 'account' | 'audit_case' | 'comparison'
  object_ref_id: number
  title: string
  payload_json: Record<string, unknown>
  created_at: string
  note: string | null
}

export interface ReportSnapshotListResponse {
  items: ReportSnapshot[]
  count: number
  total: number
  filters: {
    snapshotType: string | null
    objectType: string | null
    objectRefId: number | null
  }
}

export interface CreateReportSnapshotPayload {
  snapshot_type: 'audit_report' | 'comparison_report' | 'final_recommendation'
  object_type: 'strategy' | 'account' | 'audit_case' | 'comparison'
  object_ref_id: number
  title: string
  payload_json: Record<string, unknown>
  note?: string
}
