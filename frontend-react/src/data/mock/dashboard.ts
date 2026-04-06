import type { DashboardPayload } from '../../types/dashboard'

export const dashboardMock: DashboardPayload = {
  metrics: [
    { label: 'Total Audits', value: '124' },
    { label: 'Average Score', value: '76 / 100', tone: 'accent' },
    { label: 'Pass Rate', value: '63%' },
    { label: 'Recent Report', value: 'TrendFibPA_v1' },
  ],
  reportPipeline: [
    'Backtest audit completed for TrendFibPA_v1.',
    'Investor account audit report generated with moderate risk profile.',
    'Forward gate decision remains in review queue.',
  ],
  operationalFocus: [
    'Expand dashboard drill-down panels.',
    'Add account-level filtering for audit snapshots.',
    'Prepare Vercel preview deployments for stakeholder review.',
  ],
}
