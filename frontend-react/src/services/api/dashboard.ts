import { env } from '../../config/env'
import { dashboardMock } from '../../data/mock/dashboard'
import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import { mapDashboardSummaryToPayload } from '../mappers/dashboardMapper'
import type { DashboardPayload, DashboardSummaryResponse } from '../../types/dashboard'

export async function getDashboardData(): Promise<DashboardPayload> {
  if (env.useMockApi) {
    return dashboardMock
  }

  try {
    const summary = await get<DashboardSummaryResponse>(endpoints.dashboard.summary)
    return mapDashboardSummaryToPayload(summary)
  } catch {
    return dashboardMock
  }
}
