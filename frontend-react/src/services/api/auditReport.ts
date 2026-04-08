import { env } from '../../config/env'
import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { AuditReportCombined, AuditReportPayload } from '../../types/auditReport'

const strategyMock: AuditReportPayload = {
  kind: 'strategy',
  title: 'Strategy Audit Report',
  generatedAt: new Date().toISOString(),
  score: 74,
  verdict: 'Qualified',
  riskLevel: 'Low',
  trustLevel: 'Medium',
  decision: 'Qualified',
  recommendedNextStep: 'continue forward',
  whyThisResult: 'The strategy shows acceptable return/risk balance and passes major quality gates.',
  detailRef: '1',
  detailPath: '/backtests',
  strengths: ['Strongest factor: Return profile', 'Primary quality gates are satisfied'],
  risks: ['Weakest factor: Sample size', 'Continue monitoring in forward validation'],
  recommendedActions: [
    {
      actionKey: 'continue_forward',
      title: 'continue forward',
      description: 'Move this strategy to the forward validation path.',
      priority: 'High',
      reason: 'Decision is qualified and score supports forward progression.',
      targetPath: '/forward-gate',
    },
  ],
  timelineHighlights: [],
}

const accountMock: AuditReportPayload = {
  kind: 'account',
  title: 'Account Audit Report',
  generatedAt: new Date().toISOString(),
  score: 68,
  verdict: 'Marginal',
  riskLevel: 'Medium',
  trustLevel: 'Medium',
  decision: 'Needs Improvement',
  recommendedNextStep: 'review required',
  whyThisResult: 'The account has mixed quality signals and requires targeted follow-up.',
  detailRef: null,
  detailPath: '/account-audit',
  strengths: ['Strongest factor: Risk score'],
  risks: ['Weakest factor: Drawdown control', 'At least one pass threshold is missing'],
  recommendedActions: [
    {
      actionKey: 'review_manually',
      title: 'review manually',
      description: 'Perform manual review on weak account factors.',
      priority: 'High',
      reason: 'Decision indicates unresolved account quality gaps.',
      targetPath: '/audit-cases',
    },
  ],
  timelineHighlights: [],
}

const combinedMock: AuditReportCombined = {
  strategy: strategyMock,
  account: accountMock,
}

export async function getAuditReport(kind: 'strategy' | 'account'): Promise<AuditReportPayload> {
  if (env.useMockApi) {
    return kind === 'strategy' ? strategyMock : accountMock
  }

  try {
    return await get<AuditReportPayload>(`${endpoints.auditReport}?kind=${kind}`)
  } catch {
    return kind === 'strategy' ? strategyMock : accountMock
  }
}

export async function getAuditReportCombined(): Promise<AuditReportCombined> {
  if (env.useMockApi) {
    return combinedMock
  }

  try {
    return await get<AuditReportCombined>(endpoints.auditReport)
  } catch {
    return combinedMock
  }
}
