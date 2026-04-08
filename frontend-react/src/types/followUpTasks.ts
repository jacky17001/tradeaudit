export interface FollowUpTask {
  id: number
  object_type: 'strategy' | 'account' | 'audit_case'
  object_ref_id: number
  action_key: string
  title: string
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  priority: 'high' | 'normal' | 'low'
  due_label: 'today' | 'this_week' | 'later'
  note: string | null
  created_at: string
  updated_at: string
}

export interface FollowUpTaskListResponse {
  items: FollowUpTask[]
  count: number
  total: number
  filters: {
    objectType: string | null
    objectRefId: number | null
    status: string | null
    priority: string | null
  }
}

export interface FollowUpTaskOptions {
  objectTypes: string[]
  statuses: string[]
  priorities: string[]
  dueLabels: string[]
  actionKeys: string[]
}

export interface CreateFollowUpTaskPayload {
  object_type: 'strategy' | 'account' | 'audit_case'
  object_ref_id: number
  action_key: string
  title?: string
  status?: 'open' | 'in_progress' | 'done' | 'cancelled'
  priority?: 'high' | 'normal' | 'low'
  due_label?: 'today' | 'this_week' | 'later'
  note?: string
}

export interface PatchFollowUpTaskPayload {
  status?: 'open' | 'in_progress' | 'done' | 'cancelled'
  priority?: 'high' | 'normal' | 'low'
  due_label?: 'today' | 'this_week' | 'later'
  note?: string
}
