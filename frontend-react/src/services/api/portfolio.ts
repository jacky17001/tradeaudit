import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { PortfolioResponse } from '../../types/portfolio'

export async function getPortfolio(params: {
  kind: 'strategy' | 'account'
  riskLevel?: string
  finalRecommendation?: string
  reviewStatus?: string
  nextStep?: string
}): Promise<PortfolioResponse> {
  const qs = new URLSearchParams()
  qs.append('kind', params.kind)
  if (params.riskLevel) qs.append('riskLevel', params.riskLevel)
  if (params.finalRecommendation) qs.append('finalRecommendation', params.finalRecommendation)
  if (params.reviewStatus) qs.append('reviewStatus', params.reviewStatus)
  if (params.nextStep) qs.append('nextStep', params.nextStep)

  return get<PortfolioResponse>(`${endpoints.portfolio.list}?${qs.toString()}`)
}
