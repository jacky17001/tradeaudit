export type AuditReportAction = {
  actionKey: string
  title: string
  description: string
  priority: string
  reason: string
  targetPath: string
}

export type AuditReportTimelineItem = {
  title: string
  description: string
  createdAt: string | null
  sourceSection: string
  eventType: string
}

export type AuditReportPayload = {
  kind: 'strategy' | 'account'
  title: string
  generatedAt: string
  score: number | null
  verdict: string | null
  riskLevel: string | null
  trustLevel: string | null
  decision: string | null
  recommendedNextStep: string | null
  whyThisResult: string | null
  detailRef?: string | null
  detailPath?: string | null
  strengths: string[]
  risks: string[]
  recommendedActions: AuditReportAction[]
  timelineHighlights: AuditReportTimelineItem[]
}

export type AuditReportCombined = {
  strategy: AuditReportPayload
  account: AuditReportPayload
}
