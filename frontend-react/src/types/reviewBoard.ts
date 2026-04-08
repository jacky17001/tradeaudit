/**
 * Review Board Types
 * Stage 48: Review Status Board unified types
 */

export interface ReviewCase {
  id: number
  case_type: string
  ref_id: number
  priority: 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'closed' | 'on_watch'
  note: string | null
  created_at: string
  updated_at: string
  object_label: string
  object_detail?: {
    type: string
    label: string
    symbol?: string
    score?: number
    decision?: string
    riskScore?: number
    error?: string
  }
}

export interface ReviewBoardCasesResponse {
  items: ReviewCase[]
  total: number
  count: number
  summary: {
    byStatus: Record<string, number>
    filters: {
      status: string | null
      case_type: string | null
      priority: string | null
    }
  }
}

export interface ReviewBoardSummary {
  byStatus: Record<string, number>
  total: number
  statuses: string[]
}

export interface ReviewStatusOptions {
  statuses: string[]
  caseTypes: string[]
  priorities: string[]
}
