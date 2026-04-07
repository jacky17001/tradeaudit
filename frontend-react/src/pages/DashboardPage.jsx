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
import { getRecentImportJobs } from '../services/api/backtests'

function DashboardPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: getDashboardData,
  })

  const { data: recentJobs = [] } = useQuery({
    queryKey: queryKeys.importJobs.recent(1),
    queryFn: () => getRecentImportJobs(1),
  })
  const lastImport = recentJobs.find((j) => j.status === 'success') ?? null

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

      <DashboardImportStrip job={lastImport} language={language} t={t} />

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

function DashboardImportStrip({ job, language, t }) {
  if (!job) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">
        {t('dashboard.lastImportNone')}
      </div>
    )
  }

  const timeStr = job.triggeredAt
    ? new Date(job.triggeredAt).toLocaleString(
        language === 'zh' ? 'zh-CN' : 'en-US',
        { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
      )
    : '--'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          {t('dashboard.lastImportTitle')}
        </p>
        <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-300">
          {t('dashboard.lastImportStatus')}
        </span>
      </div>
      <div className="mt-2 grid gap-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-500">{t('dashboard.lastImportSource')}</p>
          <p className="mt-0.5 truncate font-medium text-slate-200" title={job.sourcePath}>
            {job.sourcePath || '--'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">{t('dashboard.lastImportMode')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{job.mode || '--'}</p>
        </div>
        <div>
          <p className="text-slate-500">{t('dashboard.lastImportTime')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{timeStr}</p>
        </div>
        <div>
          <p className="text-slate-500">{t('dashboard.lastImportRows')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{job.importedCount ?? '--'}</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
