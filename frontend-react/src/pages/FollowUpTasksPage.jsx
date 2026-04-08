import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getFollowUpTasks, updateFollowUpTask } from '../services/api/followUpTasks'

function statusTone(status) {
  if (status === 'done') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'in_progress') return 'warning'
  return 'default'
}

function priorityTone(priority) {
  if (priority === 'high') return 'danger'
  if (priority === 'normal') return 'warning'
  return 'default'
}

function FollowUpTasksPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.followUpTasks.list(status || undefined),
    queryFn: () => getFollowUpTasks({ status: status || undefined, limit: 200 }),
  })

  const patchMutation = useMutation({
    mutationFn: ({ taskId, nextStatus }) => updateFollowUpTask(taskId, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-tasks'] })
    },
  })

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message={t('followUpTasks.failedToLoad')} />

  const items = data.items || []

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('followUpTasks.pageTitle')}
        subtitle={t('followUpTasks.pageSubtitle')}
      >
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">{t('common.filters')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={status === '' ? 'primary' : 'secondary'} size="sm" onClick={() => setStatus('')}>
            {t('followUpTasks.all')}
          </Button>
          <Button variant={status === 'open' ? 'primary' : 'secondary'} size="sm" onClick={() => setStatus('open')}>
            {t('followUpTasks.statusOpen')}
          </Button>
          <Button
            variant={status === 'in_progress' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatus('in_progress')}
          >
            {t('followUpTasks.statusInProgress')}
          </Button>
          <Button variant={status === 'done' ? 'primary' : 'secondary'} size="sm" onClick={() => setStatus('done')}>
            {t('followUpTasks.statusDone')}
          </Button>
          <Button
            variant={status === 'cancelled' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatus('cancelled')}
          >
            {t('followUpTasks.statusCancelled')}
          </Button>
        </div>
      </SectionCard>

      {items.length === 0 ? (
        <SectionCard title={t('followUpTasks.pageTitle')}>
          <p className="text-sm text-slate-300">{t('followUpTasks.noTasksYet')}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          {items.map((task) => (
            <section
              key={task.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/30"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-100">{task.title}</h3>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(task.status)}>{t(`followUpTasks.status.${task.status}`)}</Badge>
                  <Badge tone={priorityTone(task.priority)}>{t(`followUpTasks.priority.${task.priority}`)}</Badge>
                </div>
              </div>

              <div className="mb-2 text-xs text-slate-400">
                {t('followUpTasks.object')}: {task.object_type}#{task.object_ref_id}
              </div>
              <div className="mb-2 text-xs text-slate-400">
                {t('followUpTasks.dueLabel')}: {t(`followUpTasks.due.${task.due_label}`)}
              </div>
              {task.note ? <p className="mb-3 text-sm text-slate-300">{task.note}</p> : null}
              <div className="mb-4 text-xs text-slate-500">
                {t('followUpTasks.createdAt')}: {new Date(task.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={patchMutation.isPending || task.status === 'open'}
                  onClick={() => patchMutation.mutate({ taskId: task.id, nextStatus: 'open' })}
                >
                  {t('followUpTasks.statusOpen')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={patchMutation.isPending || task.status === 'in_progress'}
                  onClick={() => patchMutation.mutate({ taskId: task.id, nextStatus: 'in_progress' })}
                >
                  {t('followUpTasks.statusInProgress')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={patchMutation.isPending || task.status === 'done'}
                  onClick={() => patchMutation.mutate({ taskId: task.id, nextStatus: 'done' })}
                >
                  {t('followUpTasks.statusDone')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={patchMutation.isPending || task.status === 'cancelled'}
                  onClick={() => patchMutation.mutate({ taskId: task.id, nextStatus: 'cancelled' })}
                >
                  {t('followUpTasks.statusCancelled')}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default FollowUpTasksPage
