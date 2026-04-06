import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getDashboardData } from '../services/api/dashboard'

function DashboardPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: getDashboardData,
  })

  if (isLoading) {
    return <LoadingState label={t('dashboard.loading')} />
  }

  if (error) {
    return <ErrorState message={t('dashboard.error')} />
  }

  if (!data || data.metrics.length === 0) {
    return <EmptyState title={t('dashboard.emptyTitle')} description={t('dashboard.emptyDesc')} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{t('dashboard.summary')}</p>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isFetching ? <span className="text-xs text-cyan-300">{t('common.refreshing')}</span> : null}
          <Button
            variant="secondary"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })}
            className="px-3 sm:px-4"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('dashboard.recentPipelineTitle')} subtitle={t('dashboard.recentPipelineSubtitle')}>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.reportPipeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title={t('dashboard.focusTitle')} subtitle={t('dashboard.focusSubtitle')}>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.operationalFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

export default DashboardPage
