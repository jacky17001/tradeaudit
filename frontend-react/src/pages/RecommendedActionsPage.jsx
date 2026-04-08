import { useMutation } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { createFollowUpTask } from '../services/api/followUpTasks'
import { getRecommendedActions } from '../services/api/recommendedActions'

function priorityTone(priority) {
  if (priority === 'High') return 'danger'
  if (priority === 'Medium') return 'warning'
  if (priority === 'Low') return 'success'
  return 'default'
}

const PRIORITY_KEY_MAP = {
  High: 'recommendedActions.priorityHigh',
  Medium: 'recommendedActions.priorityMedium',
  Low: 'recommendedActions.priorityLow',
}

const ACTION_KEY_MAP = {
  continue_forward: 'recommendedActions.actionContinueForward',
  continue_monitoring: 'recommendedActions.actionContinueMonitoring',
  review_manually: 'recommendedActions.actionReviewManually',
  collect_more_data: 'recommendedActions.actionCollectMoreData',
  reject_candidate: 'recommendedActions.actionRejectCandidate',
  archive_result: 'recommendedActions.actionArchiveResult',
  connect_mt5_read_only: 'recommendedActions.actionConnectMt5ReadOnly',
  upload_statement: 'recommendedActions.actionUploadStatement',
  upload_account_history: 'recommendedActions.actionUploadAccountHistory',
  recompute_summary: 'recommendedActions.actionRecomputeSummary',
}

function localizeByMap(raw, map, t) {
  const key = map[raw]
  return key ? t(key) : raw
}

function localizeActionTitle(item, t) {
  const key = ACTION_KEY_MAP[item.actionKey]
  if (key) return t(key)
  return item.title || t('recommendedActions.noActionAvailable')
}

function KindSwitch({ kind, t }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/80">
      <Link to="/recommended-actions?kind=strategy">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm transition ${
            kind === 'strategy' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('scoringSummary.strategyScoringSummary')}
        </button>
      </Link>
      <Link to="/recommended-actions?kind=account">
        <button
          type="button"
          className={`border-l border-slate-700 px-3 py-1.5 text-sm transition ${
            kind === 'account' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('scoringSummary.accountScoringSummary')}
        </button>
      </Link>
    </div>
  )
}

function RecommendedActionsPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const kind = searchParams.get('kind') === 'account' ? 'account' : 'strategy'
  const [feedback, setFeedback] = useState('')

  const createTaskMutation = useMutation({
    mutationFn: (payload) => createFollowUpTask(payload),
    onSuccess: () => setFeedback(t('followUpTasks.taskCreated')),
    onError: () => setFeedback(t('followUpTasks.taskCreateFailed')),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.recommendedActions.kind(kind),
    queryFn: () => getRecommendedActions(kind),
  })

  if (isLoading) {
    return <LoadingState label={t('recommendedActions.loading')} />
  }

  if (error || !data) {
    return <ErrorState message={t('recommendedActions.error')} />
  }

  const actions = data.recommendedActions || []

  const bridgeActionKey = (actionKey) => {
    if (actionKey === 'review_manually') return 'review_manually'
    if (actionKey === 'collect_more_data' || actionKey === 'upload_statement' || actionKey === 'upload_account_history') {
      return 'need_more_data'
    }
    if (actionKey === 'recompute_summary' || actionKey === 'connect_mt5_read_only') return 'sync_again'
    if (actionKey === 'continue_monitoring') return 'recheck_later'
    return 'follow_up'
  }

  const bridgePriority = (priority) => {
    if (priority === 'High') return 'high'
    if (priority === 'Low') return 'low'
    return 'normal'
  }

  const handleCreateTask = (item) => {
    setFeedback('')
    const mappedPriority = bridgePriority(item.priority)
    createTaskMutation.mutate({
      object_type: kind === 'account' ? 'account' : 'strategy',
      object_ref_id: 1,
      action_key: bridgeActionKey(item.actionKey),
      title: localizeActionTitle(item, t),
      priority: mappedPriority,
      due_label: mappedPriority === 'high' ? 'today' : 'this_week',
      note: item.reason || '',
    })
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('recommendedActions.pageTitle')}
        subtitle={t('recommendedActions.pageSubtitle')}
        actions={<KindSwitch kind={kind} t={t} />}
      >
        <div className="mb-4 space-y-2">
          <p className="text-sm text-slate-300">{t('recommendedActions.valueProp')}</p>
          <p className="text-xs text-slate-400">{t('recommendedActions.pageDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400">{t('scoringSummary.totalScore')}: <span className="text-slate-200">{data.score ?? '--'}</span></p>
          <p className="text-sm text-slate-400">{t('scoringSummary.decision')}: <span className="text-slate-200">{data.decision}</span></p>
        </div>
        {feedback ? <p className="mt-3 text-xs text-cyan-300">{feedback}</p> : null}
      </SectionCard>

      {actions.length === 0 ? (
        <SectionCard title={t('recommendedActions.pageTitle')}>
          <p className="text-sm text-slate-300">{t('recommendedActions.noActionAvailable')}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          {actions.map((item) => (
            <section
              key={`${item.actionKey}-${item.targetPath}`}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/30"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-100">{localizeActionTitle(item, t)}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('recommendedActions.priority')}</span>
                  <Badge tone={priorityTone(item.priority)}>
                    {localizeByMap(item.priority, PRIORITY_KEY_MAP, t)}
                  </Badge>
                </div>
              </div>

              <p className="mb-3 text-sm text-slate-300">{item.description}</p>

              <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-800/45 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('recommendedActions.whyThisAction')}</p>
                <p className="mt-1 text-sm text-slate-200">{item.reason}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to={item.targetPath || '/dashboard'}>
                  <Button variant="secondary">{t('recommendedActions.openAction')}</Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => handleCreateTask(item)}
                  disabled={createTaskMutation.isPending}
                >
                  {t('followUpTasks.createTask')}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default RecommendedActionsPage
