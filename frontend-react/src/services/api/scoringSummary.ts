import { env } from '../../config/env'
import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type { CombinedScoringSummary, ScoringSummaryItem } from '../../types/scoringSummary'

const strategyMock: ScoringSummaryItem = {
  kind: 'strategy',
  title: 'Strategy Scoring Summary',
  score: 74,
  decision: 'Qualified',
  strongestFactor: 'Return profile',
  weakestFactor: 'Sample size',
  confidence: 'moderate confidence',
  dataAdequacy: 'medium',
  keyStrengths: ['Strongest factor: Return profile', 'Primary quality gates are satisfied'],
  keyRisks: ['Weakest factor: Sample size', 'At least one pass threshold is missing'],
  explanation: 'The strategy score reflects return quality versus drawdown and sample sufficiency.',
  nextStep: 'Promote to forward validation and keep live monitoring active.',
  detailRef: '1',
  detailPath: '/backtests',
}

const accountMock: ScoringSummaryItem = {
  kind: 'account',
  title: 'Account Audit Scoring Summary',
  score: 68,
  decision: 'Needs Improvement',
  strongestFactor: 'Risk score',
  weakestFactor: 'Drawdown control',
  confidence: 'moderate confidence',
  dataAdequacy: 'medium',
  keyStrengths: ['Strongest factor: Risk score', 'Partial quality signal exists but needs tuning'],
  keyRisks: ['Weakest factor: Drawdown control', 'At least one pass threshold is missing'],
  explanation: 'The account score is constrained by risk consistency and drawdown pressure.',
  nextStep: 'Optimize risk controls and execution consistency, then re-evaluate.',
  detailRef: null,
  detailPath: '/account-audit',
}

const combinedMock: CombinedScoringSummary = {
  strategy: strategyMock,
  account: accountMock,
}

export async function getScoringSummary(kind: 'strategy' | 'account'): Promise<ScoringSummaryItem> {
  if (env.useMockApi) {
    return kind === 'strategy' ? strategyMock : accountMock
  }

  try {
    return await get<ScoringSummaryItem>(`${endpoints.scoringSummary}?kind=${kind}`)
  } catch {
    return kind === 'strategy' ? strategyMock : accountMock
  }
}

export async function getScoringSummaryCombined(): Promise<CombinedScoringSummary> {
  if (env.useMockApi) {
    return combinedMock
  }

  try {
    return await get<CombinedScoringSummary>(endpoints.scoringSummary)
  } catch {
    return combinedMock
  }
}
