export type DashboardMetric = {
  label: string
  value: string
  tone?: 'default' | 'accent'
}

export type DashboardPayload = {
  metrics: DashboardMetric[]
  reportPipeline: string[]
  operationalFocus: string[]
}

export type DashboardSummaryResponse = {
  totalAudits: number
  averageScore: number
  passRate: number
  recentReports: number
}
