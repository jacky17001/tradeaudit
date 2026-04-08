export interface PortfolioItem {
  id: string
  objectType: 'strategy' | 'account'
  objectRefId: string | number
  title: string
  score: number
  verdict: string
  riskLevel: string
  trustLevel: string
  finalRecommendation: string
  reviewStatus: string
  nextStep: string
  updatedAt: string
  detailPath: string
}

export interface PortfolioResponse {
  kind: 'strategy' | 'account'
  items: PortfolioItem[]
  total: number
  filtersEcho: {
    riskLevel: string | null
    finalRecommendation: string | null
    reviewStatus: string | null
    nextStep: string | null
  }
}
