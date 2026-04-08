import { env } from '../../config/env'
import { resultOverviewMock } from '../../data/mock/resultOverview'
import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { ResultOverviewPayload } from '../../types/resultOverview'

export async function getResultOverview(): Promise<ResultOverviewPayload> {
  if (env.useMockApi) {
    return resultOverviewMock
  }

  try {
    return await get<ResultOverviewPayload>(endpoints.resultOverview)
  } catch {
    return resultOverviewMock
  }
}
