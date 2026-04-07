import { endpoints } from '../endpoints'
import { get, post } from '../../lib/http'

export interface ReviewNote {
  id: number
  case_id: number
  content: string
  note_type: string
  created_at: string
  created_by: string
}

export interface ReviewAction {
  id: number
  case_id: number  
  action: string
  reason?: string
  previous_status?: string
  new_status?: string
  created_at: string
  created_by: string
}

export interface NotesResponse {
  case_id: number
  items: ReviewNote[]
  count: number
  latest?: ReviewNote
}

export interface ActionsResponse {
  case_id: number
  case_status: string
  notes: ReviewNote[]
  notes_count: number
  actions: ReviewAction[]
  actions_count: number
  latest_note?: ReviewNote
  latest_action?: ReviewAction
}

export interface DecisionResponse {
  case_id: number
  has_decision: boolean
  action?: string
  reason?: string
  decided_at?: string
  decided_by?: string
}

export async function addNoteToCase(
  caseId: number,
  content: string,
  noteType: string = 'comment'
): Promise<ReviewNote> {
  return post<ReviewNote, { content: string; note_type: string }>(endpoints.auditCases.notes(caseId), {
    content,
    note_type: noteType,
  })
}

export async function getNotesForCase(caseId: number, limit: number = 100): Promise<NotesResponse> {
  const url = `${endpoints.auditCases.notes(caseId)}?limit=${limit}`
  return get<NotesResponse>(url)
}

export async function takeActionOnCase(
  caseId: number,
  action: string,
  reason?: string
): Promise<ReviewAction> {
  return post<ReviewAction, { action: string; reason?: string }>(endpoints.auditCases.actions(caseId), {
    action,
    reason,
  })
}

export async function getActionsForCase(caseId: number): Promise<ActionsResponse> {
  return get<ActionsResponse>(endpoints.auditCases.actions(caseId))
}

export async function getCaseDecision(caseId: number): Promise<DecisionResponse> {
  return get<DecisionResponse>(endpoints.auditCases.decision(caseId))
}
