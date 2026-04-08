import { env } from '../../config/env'
import { get } from '../../lib/http'
import { endpoints } from '../endpoints'
import type {
  RecommendedActionsCombined,
  RecommendedActionsPayload,
} from '../../types/recommendedActions'

const strategyMock: RecommendedActionsPayload = {
  kind: 'strategy',
  title: 'Strategy Recommended Actions',
  score: 74,
  decision: 'Qualified',
  recommendedActions: [
    {
      actionKey: 'continue_forward',
      title: 'continue forward',
      description: 'Move this strategy to the forward validation path.',
      priority: 'High',
      reason: 'Decision is qualified and score supports forward progression.',
      targetPath: '/forward-gate',
    },
    {
      actionKey: 'continue_monitoring',
      title: 'continue monitoring',
      description: 'Keep tracking stability and risk behavior after qualification.',
      priority: 'Medium',
      reason: 'Even qualified strategies need ongoing monitoring.',
      targetPath: '/forward-gate',
    },
  ],
}

const accountMock: RecommendedActionsPayload = {
  kind: 'account',
  title: 'Account Recommended Actions',
  score: 68,
  decision: 'Needs Improvement',
  recommendedActions: [
    {
      actionKey: 'review_manually',
      title: 'review manually',
      description: 'Perform manual review on weak account factors.',
      priority: 'High',
      reason: 'Decision indicates unresolved account quality gaps.',
      targetPath: '/audit-cases',
    },
    {
      actionKey: 'recompute_summary',
      title: 'recompute summary',
      description: 'Recompute summary after new intake or sync records.',
      priority: 'Medium',
      reason: 'Updated data may improve score reliability.',
      targetPath: '/account-audit',
    },
  ],
}

const combinedMock: RecommendedActionsCombined = {
  strategy: strategyMock,
  account: accountMock,
}

export async function getRecommendedActions(kind: 'strategy' | 'account'): Promise<RecommendedActionsPayload> {
  if (env.useMockApi) {
    return kind === 'strategy' ? strategyMock : accountMock
  }

  try {
    return await get<RecommendedActionsPayload>(`${endpoints.recommendedActions}?kind=${kind}`)
  } catch {
    return kind === 'strategy' ? strategyMock : accountMock
  }
}

export async function getRecommendedActionsCombined(): Promise<RecommendedActionsCombined> {
  if (env.useMockApi) {
    return combinedMock
  }

  try {
    return await get<RecommendedActionsCombined>(endpoints.recommendedActions)
  } catch {
    return combinedMock
  }
}
