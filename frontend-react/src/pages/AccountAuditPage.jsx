import { useQuery, useQueryClient } from '@tanstack/react-query'
import EvaluationSummaryCard from '../components/evaluation/EvaluationSummaryCard'
import SectionCard from '../components/SectionCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import StatCard from '../components/ui/StatCard'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getAuditData } from '../services/api/audit'
import { getEvaluationHistory } from '../services/api/evaluationHistory'

function AccountAuditPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.audit.all,
    queryFn: getAuditData,
  })

  const { data: historyItems = [] } = useQuery({
    queryKey: queryKeys.evaluations.history('account-audit', 'account-main', 5),
    queryFn: () => getEvaluationHistory('account-audit', 'account-main', 5),
    enabled: !!data,
  })

  if (isLoading) {
    return <LoadingState label={t('accountAudit.loading')} />
  }

  if (error) {
    return <ErrorState message={t('accountAudit.error')} />
  }

  if (!data) {
    return (
      <EmptyState
        title={t('accountAudit.emptyTitle')}
        description={t('accountAudit.emptyDesc')}
      />
    )
  }

  const breakdownLabels = {
    riskScore: t('accountAudit.riskScore'),
    maxDrawdown: t('accountAudit.maxDrawdown'),
    winRate: t('accountAudit.winRate'),
    profitFactor: t('accountAudit.profitFactor'),
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{t('accountAudit.title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.accountName} · {data.broker}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">{t('common.refreshing')}</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.audit.all })
            }
            className="px-3 sm:px-4"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Balance & Equity */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('accountAudit.balance')} value={`$${data.balance.toLocaleString()}`} />
        <StatCard label={t('accountAudit.equity')} value={`$${data.equity.toLocaleString()}`} />
        <StatCard label={t('accountAudit.riskScore')} value={`${data.riskScore} / 100`} tone="accent" />
        <StatCard label={t('accountAudit.profitFactor')} value={String(data.profitFactor)} />
      </div>

      <EvaluationSummaryCard
        finalScore={data.finalScore}
        scoreBreakdown={data.scoreBreakdown}
        decision={data.decision}
        decisionReason={data.decisionReason}
        recommendedAction={data.recommendedAction}
        explanation={data.explanation}
        breakdownLabels={breakdownLabels}
        hardFailTriggered={data.hardFailTriggered}
        hardFailReasons={data.hardFailReasons}
        strongestFactor={data.strongestFactor}
        weakestFactor={data.weakestFactor}
        confidenceLevel={data.confidenceLevel}
        sampleAdequacy={data.sampleAdequacy}
        dataSourceType={data.dataSourceType}
        evaluatedAt={data.evaluatedAt}
        rulesVersion={data.rulesVersion}
        datasetVersion={data.datasetVersion}
        previousScore={data.previousScore}
        scoreDelta={data.scoreDelta}
        previousDecision={data.previousDecision}
        decisionChanged={data.decisionChanged}
        historyItems={historyItems}
      />

      {/* Risk metrics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('accountAudit.performanceTitle')} subtitle={t('accountAudit.performanceSubtitle')}>
          <div className="space-y-3">
            <MetricRow label={t('accountAudit.winRate')} value={`${data.winRate}%`} />
            <MetricRow label={t('accountAudit.maxDrawdown')} value={`${data.maxDrawdown}%`} warn={data.maxDrawdown > 10} />
            <MetricRow label={t('accountAudit.profitFactor')} value={String(data.profitFactor)} />
          </div>
        </SectionCard>

        <SectionCard title={t('accountAudit.aiTitle')} subtitle={t('accountAudit.aiSubtitle')}>
          <p className="text-sm leading-7 text-slate-300">{data.aiExplanation}</p>
        </SectionCard>
      </div>
    </div>
  )
}

function MetricRow({ label, value, warn = false }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={warn ? 'text-rose-400 font-medium' : 'text-slate-200 font-medium'}>
        {value}
      </span>
    </div>
  )
}

export default AccountAuditPage
