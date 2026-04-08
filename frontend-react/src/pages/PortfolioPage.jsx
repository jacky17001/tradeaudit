import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getPortfolio } from '../services/api/portfolio'
import { createFollowUpTask } from '../services/api/followUpTasks'

function toneRisk(value) {
  if (value === 'High') return 'danger'
  if (value === 'Medium') return 'warning'
  if (value === 'Low') return 'success'
  return 'default'
}

function toneRecommendation(value) {
  if (value === 'Recommended') return 'success'
  if (value === 'Watchlist') return 'warning'
  if (value === 'Not Recommended') return 'danger'
  return 'default'
}

function toneStatus(value) {
  if (value === 'closed' || value === 'done') return 'success'
  if (value === 'in_progress') return 'warning'
  if (value === 'cancelled') return 'danger'
  return 'default'
}

function PortfolioPage() {
  const { t, language } = useLanguage()
  const [kind, setKind] = useState('strategy')
  const [riskLevel, setRiskLevel] = useState('')
  const [finalRecommendation, setFinalRecommendation] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [taskFeedback, setTaskFeedback] = useState('')

  const query = useQuery({
    queryKey: queryKeys.portfolio.list(kind, riskLevel || undefined, finalRecommendation || undefined, reviewStatus || undefined, nextStep || undefined),
    queryFn: () =>
      getPortfolio({
        kind,
        riskLevel: riskLevel || undefined,
        finalRecommendation: finalRecommendation || undefined,
        reviewStatus: reviewStatus || undefined,
        nextStep: nextStep || undefined,
      }),
  })

  const taskMutation = useMutation({
    mutationFn: (payload) => createFollowUpTask(payload),
    onSuccess: () => setTaskFeedback(t('followUpTasks.taskCreated')),
    onError: () => setTaskFeedback(t('followUpTasks.taskCreateFailed')),
  })

  const items = query.data?.items || []

  const recommendationOptions = useMemo(
    () => ['Recommended', 'Watchlist', 'Needs More Data', 'Not Recommended'],
    []
  )

  const statusOptions = useMemo(() => ['open', 'in_progress', 'on_watch', 'closed'], [])

  const nextStepOptions = useMemo(
    () => ['continue forward', 'recheck later', 'need more data', 'review manually'],
    []
  )

  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message={t('portfolio.failedToLoad')} />

  return (
    <div className="space-y-6">
      <SectionCard title={t('portfolio.pageTitle')} subtitle={t('portfolio.pageSubtitle')}>
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">{t('portfolio.batchReview')}</p>
        <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/80">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm transition ${
              kind === 'strategy' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
            }`}
            onClick={() => setKind('strategy')}
          >
            {t('portfolio.strategyPortfolio')}
          </button>
          <button
            type="button"
            className={`border-l border-slate-700 px-3 py-1.5 text-sm transition ${
              kind === 'account' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
            }`}
            onClick={() => setKind('account')}
          >
            {t('portfolio.accountPortfolio')}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-400">
            {t('portfolio.filterByRisk')}
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">{t('followUpTasks.all')}</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            {t('portfolio.filterByRecommendation')}
            <select
              value={finalRecommendation}
              onChange={(e) => setFinalRecommendation(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">{t('followUpTasks.all')}</option>
              {recommendationOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            {t('portfolio.filterByStatus')}
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">{t('followUpTasks.all')}</option>
              {statusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            {t('portfolio.nextStep')}
            <select
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">{t('followUpTasks.all')}</option>
              {nextStepOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
        </div>

        {taskFeedback ? <p className="mt-3 text-xs text-cyan-300">{taskFeedback}</p> : null}
      </SectionCard>

      {items.length === 0 ? (
        <SectionCard title={t('portfolio.pageTitle')}>
          <p className="text-sm text-slate-300">{t('portfolio.noItemsFound')}</p>
        </SectionCard>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-2 py-2">{t('portfolio.objectLabel')}</th>
                  <th className="px-2 py-2">{t('auditReport.score')}</th>
                  <th className="px-2 py-2">{t('auditReport.verdict')}</th>
                  <th className="px-2 py-2">{t('portfolio.filterByRisk')}</th>
                  <th className="px-2 py-2">{t('auditReport.trust')}</th>
                  <th className="px-2 py-2">{t('portfolio.finalRecommendation')}</th>
                  <th className="px-2 py-2">{t('portfolio.reviewStatus')}</th>
                  <th className="px-2 py-2">{t('portfolio.nextStep')}</th>
                  <th className="px-2 py-2">{t('reportSnapshots.savedAt')}</th>
                  <th className="px-2 py-2">{t('portfolio.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/60">
                    <td className="px-2 py-3 text-slate-100">
                      <div>{item.title}</div>
                      <div className="text-xs text-slate-500">{item.objectType}#{item.objectRefId}</div>
                    </td>
                    <td className="px-2 py-3 text-slate-200">{item.score ?? '--'}</td>
                    <td className="px-2 py-3 text-slate-200">{item.verdict || '--'}</td>
                    <td className="px-2 py-3"><Badge tone={toneRisk(item.riskLevel)}>{item.riskLevel || '--'}</Badge></td>
                    <td className="px-2 py-3 text-slate-200">{item.trustLevel || '--'}</td>
                    <td className="px-2 py-3"><Badge tone={toneRecommendation(item.finalRecommendation)}>{item.finalRecommendation || '--'}</Badge></td>
                    <td className="px-2 py-3"><Badge tone={toneStatus(item.reviewStatus)}>{item.reviewStatus || '--'}</Badge></td>
                    <td className="px-2 py-3 text-slate-200">{item.nextStep || '--'}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '--'}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={item.detailPath || '/audit-report'}>
                          <Button variant="secondary" size="sm">{t('portfolio.viewReport')}</Button>
                        </Link>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={taskMutation.isPending}
                          onClick={() => {
                            setTaskFeedback('')
                            taskMutation.mutate({
                              object_type: item.objectType,
                              object_ref_id: Number(item.objectRefId) || 1,
                              action_key: 'follow_up',
                              title: `${t('followUpTasks.followUp')}: ${item.title}`,
                              priority: item.riskLevel === 'High' ? 'high' : 'normal',
                              due_label: item.riskLevel === 'High' ? 'today' : 'this_week',
                              note: item.nextStep || '',
                            })
                          }}
                        >
                          {t('followUpTasks.createTask')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PortfolioPage
