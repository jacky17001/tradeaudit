import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import StatCard from '../components/ui/StatCard'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getForwardGateData } from '../services/api/forwardGate'

const FORWARD_STATUS_TONE = {
  RUNNING: 'accent',
  PAUSED: 'warning',
  COMPLETED: 'success',
}

const GATE_DECISION_TONE = {
  PASS: 'success',
  PENDING: 'warning',
  FAIL: 'danger',
}

function ForwardGatePage() {
  const { language, t } = useLanguage()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.forwardGate.all,
    queryFn: getForwardGateData,
  })

  if (isLoading) {
    return <LoadingState label={t('forwardGate.loading')} />
  }

  if (error) {
    return <ErrorState message={t('forwardGate.error')} />
  }

  if (!data) {
    return <EmptyState title={t('forwardGate.emptyTitle')} description={t('forwardGate.emptyDesc')} />
  }

  const statusTone = FORWARD_STATUS_TONE[data.forwardStatus] ?? 'default'
  const decisionTone = GATE_DECISION_TONE[data.gateDecision] ?? 'default'

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{t('forwardGate.title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.strategyName} · {data.symbol}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">{t('common.refreshing')}</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.forwardGate.all })
            }
            className="px-3 sm:px-4"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('forwardGate.tradesObserved')} value={String(data.tradesObserved)} />
        <StatCard label={t('forwardGate.passRate')} value={`${data.passRate}%`} />
        <StatCard
          label={t('forwardGate.maxDrawdown')}
          value={`${data.maxDrawdown}%`}
          tone={data.maxDrawdown > 10 ? 'danger' : undefined}
        />
        <StatCard label={t('forwardGate.lastUpdated')} value={data.lastUpdated} />
      </div>

      {/* Status badges + summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('forwardGate.validationTitle')} subtitle={t('forwardGate.validationSubtitle')}>
          <div className="space-y-4">
            <StatusRow label={t('forwardGate.forwardStatus')}>
              <Badge tone={statusTone}>
                {language === 'zh'
                  ? data.forwardStatus === 'RUNNING'
                    ? '运行中'
                    : data.forwardStatus === 'PAUSED'
                      ? '已暂停'
                      : data.forwardStatus === 'COMPLETED'
                        ? '已完成'
                        : data.forwardStatus
                  : data.forwardStatus}
              </Badge>
            </StatusRow>
            <StatusRow label={t('forwardGate.gateDecision')}>
              <Badge tone={decisionTone}>
                {language === 'zh'
                  ? data.gateDecision === 'PASS'
                    ? '通过'
                    : data.gateDecision === 'PENDING'
                      ? '待定'
                      : data.gateDecision === 'FAIL'
                        ? '失败'
                        : data.gateDecision
                  : data.gateDecision}
              </Badge>
            </StatusRow>
          </div>
        </SectionCard>

        <SectionCard title={t('forwardGate.summaryTitle')} subtitle={t('forwardGate.summarySubtitle')}>
          <p className="text-sm leading-7 text-slate-300">{data.summary}</p>
        </SectionCard>
      </div>
    </div>
  )
}

function StatusRow({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      {children}
    </div>
  )
}

export default ForwardGatePage
