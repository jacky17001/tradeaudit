import { dashboardMock } from '../../data/mock/dashboard'
import type { DashboardPayload, DashboardSummaryResponse } from '../../types/dashboard'

export function mapDashboardSummaryToPayload(summary: DashboardSummaryResponse): DashboardPayload {
  return {
    metrics: [
      { label: 'Total Audits', value: String(summary.totalAudits) },
      { label: 'Average Score', value: `${summary.averageScore} / 100`, tone: 'accent' },
      { label: 'Pass Rate', value: `${summary.passRate}%` },
      { label: 'Recent Report', value: String(summary.recentReports) },
    ],
    reportPipeline: dashboardMock.reportPipeline,
    operationalFocus: dashboardMock.operationalFocus,
  }
}
