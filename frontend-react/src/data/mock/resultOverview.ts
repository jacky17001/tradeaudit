import type { ResultOverviewPayload } from '../../types/resultOverview'

export const resultOverviewMock: ResultOverviewPayload = {
  strategyOverview: {
    title: 'Strategy Audit',
    score: 74,
    verdict: 'Qualified',
    riskLevel: 'Low',
    trustLevel: 'Medium',
    recommendedNextStep: 'continue forward',
    refId: '1',
    strategyName: 'TrendFibPA_v1',
    isCandidate: true,
  },
  accountOverview: {
    title: 'Account Audit',
    score: 68,
    verdict: 'Marginal',
    riskLevel: 'Medium',
    trustLevel: 'Medium',
    recommendedNextStep: 'review required',
    refId: null,
  },
}
