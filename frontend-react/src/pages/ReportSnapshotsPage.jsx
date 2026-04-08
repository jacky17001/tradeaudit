import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getReportSnapshotDetail, getReportSnapshots } from '../services/api/reportSnapshots'

function snapshotTypeTone(snapshotType) {
  if (snapshotType === 'final_recommendation') return 'success'
  if (snapshotType === 'comparison_report') return 'warning'
  return 'default'
}

function objectTypeTone(objectType) {
  if (objectType === 'strategy') return 'success'
  if (objectType === 'account') return 'warning'
  return 'default'
}

function prettyType(snapshotType, t) {
  if (snapshotType === 'audit_report') return t('reportSnapshots.auditReportSnapshot')
  if (snapshotType === 'comparison_report') return t('reportSnapshots.comparisonReportSnapshot')
  return t('reportSnapshots.finalRecommendationSnapshot')
}

function ReportSnapshotsPage() {
  const { t, language } = useLanguage()
  const [snapshotTypeFilter, setSnapshotTypeFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const listQuery = useQuery({
    queryKey: queryKeys.reportSnapshots.list(snapshotTypeFilter || undefined),
    queryFn: () => getReportSnapshots({ snapshotType: snapshotTypeFilter || undefined, limit: 200 }),
  })

  const detailQuery = useQuery({
    queryKey: queryKeys.reportSnapshots.detail(selectedId || 0),
    queryFn: () => getReportSnapshotDetail(selectedId),
    enabled: Boolean(selectedId),
  })

  if (listQuery.isLoading) return <LoadingState />
  if (listQuery.isError || !listQuery.data) return <ErrorState message={t('reportSnapshots.failedToLoad')} />

  const items = listQuery.data.items || []
  const selectedSnapshot = detailQuery.data

  const prettyJson = useMemo(() => {
    if (!selectedSnapshot?.payload_json) return ''
    try {
      return JSON.stringify(selectedSnapshot.payload_json, null, 2)
    } catch {
      return '{}'
    }
  }, [selectedSnapshot])

  return (
    <div className="space-y-6">
      <SectionCard title={t('reportSnapshots.pageTitle')} subtitle={t('reportSnapshots.pageSubtitle')}>
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">{t('common.filters')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={snapshotTypeFilter === '' ? 'primary' : 'secondary'}
            onClick={() => setSnapshotTypeFilter('')}
          >
            {t('followUpTasks.all')}
          </Button>
          <Button
            size="sm"
            variant={snapshotTypeFilter === 'audit_report' ? 'primary' : 'secondary'}
            onClick={() => setSnapshotTypeFilter('audit_report')}
          >
            {t('reportSnapshots.auditReportSnapshot')}
          </Button>
          <Button
            size="sm"
            variant={snapshotTypeFilter === 'comparison_report' ? 'primary' : 'secondary'}
            onClick={() => setSnapshotTypeFilter('comparison_report')}
          >
            {t('reportSnapshots.comparisonReportSnapshot')}
          </Button>
          <Button
            size="sm"
            variant={snapshotTypeFilter === 'final_recommendation' ? 'primary' : 'secondary'}
            onClick={() => setSnapshotTypeFilter('final_recommendation')}
          >
            {t('reportSnapshots.finalRecommendationSnapshot')}
          </Button>
        </div>
      </SectionCard>

      {items.length === 0 ? (
        <SectionCard title={t('reportSnapshots.pageTitle')}>
          <p className="text-sm text-slate-300">{t('reportSnapshots.noSnapshotsYet')}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {items.map((item) => (
              <section
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  <Badge tone={snapshotTypeTone(item.snapshot_type)}>{prettyType(item.snapshot_type, t)}</Badge>
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone={objectTypeTone(item.object_type)}>{item.object_type}</Badge>
                  <span className="text-xs text-slate-400">#{item.object_ref_id}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {t('reportSnapshots.savedAt')}: {new Date(item.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
                </p>
                {item.note ? <p className="mt-2 text-xs text-slate-300">{item.note}</p> : null}
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedId(item.id)}>
                    {t('reportSnapshots.viewSnapshot')}
                  </Button>
                </div>
              </section>
            ))}
          </div>

          <SectionCard title={t('reportSnapshots.snapshotDetail')}>
            {!selectedId ? (
              <p className="text-sm text-slate-300">{t('reportSnapshots.viewSnapshotHint')}</p>
            ) : detailQuery.isLoading ? (
              <LoadingState label={t('common.loading')} />
            ) : detailQuery.isError || !selectedSnapshot ? (
              <ErrorState message={t('reportSnapshots.failedToLoadDetail')} />
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  <p>{t('reportSnapshots.snapshotType')}: {prettyType(selectedSnapshot.snapshot_type, t)}</p>
                  <p>{t('reportSnapshots.savedAt')}: {new Date(selectedSnapshot.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                </div>
                <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
{prettyJson}
                </pre>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}

export default ReportSnapshotsPage
