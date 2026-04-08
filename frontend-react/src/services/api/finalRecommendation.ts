import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { FinalRecommendationCombined, FinalRecommendationPayload } from '../../types/finalRecommendation'

const strategyFallback: FinalRecommendationPayload = {
  kind: 'strategy',
  finalRecommendation: 'Watchlist',
  finalStatus: 'Monitoring Required',
  reviewerNote: '',
  decisionSnapshot: {
    source: 'rule_fallback',
    caseId: null,
    caseType: null,
    caseStatus: null,
    latestAction: null,
    decidedAt: null,
    reviewedBy: null,
  },
  whyThisRecommendation: 'Signals are mixed; keep under watch while validating weak factors.',
  supportingSignals: ['Score=68', 'Verdict=Marginal', 'Risk=Medium', 'Trust=Medium'],
  recommendedNextStep: 'review required',
  detailRef: null,
  detailPath: '/audit-report',
}

const accountFallback: FinalRecommendationPayload = {
  ...strategyFallback,
  kind: 'account',
  recommendedNextStep: 'continue monitoring',
  detailPath: '/account-audit',
}

const combinedFallback: FinalRecommendationCombined = {
  strategy: strategyFallback,
  account: accountFallback,
}

export async function getFinalRecommendation(kind: 'strategy' | 'account'): Promise<FinalRecommendationPayload> {
  try {
    return await get<FinalRecommendationPayload>(`${endpoints.finalRecommendation}?kind=${kind}`)
  } catch {
    return kind === 'strategy' ? strategyFallback : accountFallback
  }
}

export async function getFinalRecommendationCombined(): Promise<FinalRecommendationCombined> {
  try {
    return await get<FinalRecommendationCombined>(endpoints.finalRecommendation)
  } catch {
    return combinedFallback
  }
}
