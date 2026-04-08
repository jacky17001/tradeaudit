import { get, patch, post } from '../../lib/http'
import { endpoints } from '../endpoints'
import type {
  CreateFollowUpTaskPayload,
  FollowUpTask,
  FollowUpTaskListResponse,
  FollowUpTaskOptions,
  PatchFollowUpTaskPayload,
} from '../../types/followUpTasks'

export async function createFollowUpTask(payload: CreateFollowUpTaskPayload): Promise<FollowUpTask> {
  return post<FollowUpTask, CreateFollowUpTaskPayload>(endpoints.followUpTasks.create, payload)
}

export async function getFollowUpTasks(params?: {
  objectType?: string
  objectRefId?: number
  status?: string
  priority?: string
  limit?: number
}): Promise<FollowUpTaskListResponse> {
  const qs = new URLSearchParams()
  if (params?.objectType) qs.append('objectType', params.objectType)
  if (typeof params?.objectRefId === 'number') qs.append('objectRefId', String(params.objectRefId))
  if (params?.status) qs.append('status', params.status)
  if (params?.priority) qs.append('priority', params.priority)
  if (typeof params?.limit === 'number') qs.append('limit', String(params.limit))

  const q = qs.toString()
  const url = q ? `${endpoints.followUpTasks.list}?${q}` : endpoints.followUpTasks.list
  return get<FollowUpTaskListResponse>(url)
}

export async function updateFollowUpTask(taskId: number, payload: PatchFollowUpTaskPayload): Promise<FollowUpTask> {
  return patch<FollowUpTask, PatchFollowUpTaskPayload>(endpoints.followUpTasks.update(taskId), payload)
}

export async function getFollowUpTaskOptions(): Promise<FollowUpTaskOptions> {
  return get<FollowUpTaskOptions>(endpoints.followUpTasks.options)
}
