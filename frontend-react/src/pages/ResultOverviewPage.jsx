import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getResultOverview } from '../services/api/resultOverview'

// ------------------------------------------------------------------
// Verdict / Risk / Trust badge tones
// ------------------------------------------------------------------
function verdictTone(verdict) {
  if (verdict === 'Qualified' || verdict === '合格') return 'success'
  if (verdict === 'Marginal' || verdict === '边界') return 'warning'
  if (verdict === 'Rejected' || verdict === '不通过') return 'danger'
  return 'default'
}

function riskTone(level) {
  if (level === 'Low' || level === '低风险') return 'success'
  if (level === 'Medium' || level === '中风险') return 'warning'
  if (level === 'High' || level === '高风险') return 'danger'
  return 'default'
}

function trustTone(level) {
  if (level === 'High' || level === '高') return 'success'
  if (level === 'Medium' || level === '中') return 'warning'
  if (level === 'Low' || level === '低') return 'danger'
  return 'default'
}

// ------------------------------------------------------------------
// Map backend canonical strings to i18n keys
// ------------------------------------------------------------------
const VERDICT_KEY_MAP = {
  Qualified: 'resultOverview.verdictQualified',
  Marginal: 'resultOverview.verdictMarginal',
  Rejected: 'resultOverview.verdictRejected',
  'No Data': 'resultOverview.verdictNoData',
  Unknown: 'resultOverview.verdictUnknown',
}

const RISK_KEY_MAP = {
  High: 'resultOverview.riskHigh',
  Medium: 'resultOverview.riskMedium',
  Low: 'resultOverview.riskLow',
  Unknown: 'resultOverview.riskUnknown',
}

const TRUST_KEY_MAP = {
  High: 'resultOverview.trustHigh',
  Medium: 'resultOverview.trustMedium',
  Low: 'resultOverview.trustLow',
  Unknown: 'resultOverview.trustUnknown',
}

const NEXT_STEP_KEY_MAP = {
  'continue forward': 'resultOverview.nextStepContinueForward',
  'continue monitoring': 'resultOverview.nextStepContinueMonitoring',
  'review required': 'resultOverview.nextStepReviewRequired',
  'collect more data': 'resultOverview.nextStepCollectMoreData',
  'not enough data': 'resultOverview.nextStepNotEnoughData',
}

function localizeField(value, map, t) {
  const key = map[value]
  return key ? t(key) : value
}

// ------------------------------------------------------------------
// OverviewCard – each strategy / account block
// ------------------------------------------------------------------
function OverviewCard({ entry, detailPath, t }) {
  const hasScore = entry.score !== null && entry.score !== undefined

  const localVerdict = localizeField(entry.verdict, VERDICT_KEY_MAP, t)
  const localRisk = localizeField(entry.riskLevel, RISK_KEY_MAP, t)
  const localTrust = localizeField(entry.trustLevel, TRUST_KEY_MAP, t)
  const localNextStep = localizeField(entry.recommendedNextStep, NEXT_STEP_KEY_MAP, t)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40">
      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">
          {entry.title === 'Strategy Audit'
            ? t('resultOverview.strategyAudit')
            : t('resultOverview.accountAudit')}
        </h2>
        {entry.isCandidate ? (
          <Badge tone="accent">{t('resultOverview.candidateBadge')}</Badge>
        ) : null}
      </div>

      {/* Strategy name if available */}
      {entry.strategyName ? (
        <p className="mb-4 text-sm text-slate-400">
          {t('resultOverview.strategyLabel')}: <span className="text-slate-200">{entry.strategyName}</span>
        </p>
      ) : null}

      {/* Big score */}
      <div className="mb-6 flex items-end gap-3">
        <span className={`text-5xl font-bold ${hasScore ? 'text-cyan-300' : 'text-slate-500'}`}>
          {hasScore ? entry.score : '--'}
        </span>
        <span className="mb-1 text-sm text-slate-400">{t('resultOverview.overallScore')}</span>
      </div>

      {/* Verdict / Risk / Trust badges */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('resultOverview.verdict')}</span>
          <Badge tone={verdictTone(entry.verdict)}>{localVerdict}</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('resultOverview.riskLevel')}</span>
          <Badge tone={riskTone(entry.riskLevel)}>{localRisk}</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('resultOverview.trustLevel')}</span>
          <Badge tone={trustTone(entry.trustLevel)}>{localTrust}</Badge>
        </div>
      </div>

      {/* Recommended next step */}
      <div className="mb-6 rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-3">
        <p className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-500">
          {t('resultOverview.recommendedNextStep')}
        </p>
        <p className="text-sm font-medium text-slate-200">{localNextStep}</p>
      </div>

      {/* View Details link */}
      {detailPath ? (
        <div>
          <Link to={detailPath}>
            <Button variant="secondary">
              {t('resultOverview.viewScoreDetails')}
            </Button>
          </Link>
        </div>
      ) : null}

      {/* No-data hint */}
      {!hasScore ? (
        <p className="mt-3 text-xs text-slate-500 italic">{t('resultOverview.noDataHint')}</p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------
function ResultOverviewPage() {
  const { t } = useLanguage()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.resultOverview.all,
    queryFn: getResultOverview,
  })

  if (isLoading) {
    return <LoadingState label={t('resultOverview.loading')} />
  }

  if (error) {
    return <ErrorState message={t('resultOverview.error')} />
  }

  if (!data) {
    return <EmptyState title={t('resultOverview.noData')} description={t('resultOverview.noDataHint')} />
  }

  return (
    <div className="space-y-8">
      {/* Page header + value prop */}
      <SectionCard
        title={t('resultOverview.pageTitle')}
        subtitle={t('resultOverview.valueProp')}
      >
        <p className="text-sm text-slate-300">{t('resultOverview.pageDescription')}</p>
      </SectionCard>

      {/* Two overview cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OverviewCard
          entry={data.strategyOverview}
          detailPath="/scoring-summary?kind=strategy"
          t={t}
        />
        <OverviewCard
          entry={data.accountOverview}
          detailPath="/scoring-summary?kind=account"
          t={t}
        />
      </div>
    </div>
  )
}

export default ResultOverviewPage
