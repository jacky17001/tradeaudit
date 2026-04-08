import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { ComparisonReportPayload } from '../../types/comparisonReport'

const strategyFallback: ComparisonReportPayload = {
  kind: 'strategy',
  left: {
    id: 'left',
    label: 'Left Strategy',
    score: 72,
    verdict: 'Qualified',
    riskLevel: 'Low',
    trustLevel: 'Medium',
    recommendedNextStep: 'continue forward',
  },
  right: {
    id: 'right',
    label: 'Right Strategy',
    score: 68,
    verdict: 'Marginal',
    riskLevel: 'Medium',
    trustLevel: 'Medium',
    recommendedNextStep: 'review required',
  },
  winner: 'left',
  recommendation: 'Better choice: Left',
  summaryConclusion: 'Left is currently the better choice based on score, risk, and trust profile.',
  keyDifferences: [
    'Left has higher score (72 vs 68).',
    'Left has lower risk (Low vs Medium).',
  ],
  scoreComparison: { left: 72, right: 68, delta: 4, winner: 'left' },
  riskComparison: { left: 'Low', right: 'Medium', winner: 'left' },
  trustComparison: { left: 'Medium', right: 'Medium', winner: 'close' },
  actionComparison: { left: 'continue forward', right: 'review required' },
}

const accountFallback: ComparisonReportPayload = {
  ...strategyFallback,
  kind: 'account',
  left: { ...strategyFallback.left, label: 'Left Account Summary' },
  right: { ...strategyFallback.right, label: 'Right Account Summary' },
}

export async function getComparisonReport(kind: 'strategy' | 'account', left?: string, right?: string): Promise<ComparisonReportPayload> {
  const params = new URLSearchParams({ kind })
  if (left) params.set('left', left)
  if (right) params.set('right', right)
  try {
    return await get<ComparisonReportPayload>(`${endpoints.comparisonReport}?${params.toString()}`)
  } catch {
    return kind === 'strategy' ? strategyFallback : accountFallback
  }
}
