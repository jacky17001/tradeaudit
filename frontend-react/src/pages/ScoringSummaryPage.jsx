import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getScoringSummary } from '../services/api/scoringSummary'

function toneFromDecision(decision) {
  if (decision === 'Qualified') return 'success'
  if (decision === 'Needs Improvement') return 'warning'
  if (decision === 'Rejected') return 'danger'
  return 'default'
}

function toneFromSignal(text) {
  const normalized = String(text || '').toLowerCase()
  if (normalized.includes('high')) return 'success'
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'warning'
  if (normalized.includes('low')) return 'danger'
  return 'default'
}

const DECISION_KEY_MAP = {
  Qualified: 'scoringSummary.decisionQualified',
  'Needs Improvement': 'scoringSummary.decisionNeedsImprovement',
  Rejected: 'scoringSummary.decisionRejected',
  'No Data': 'scoringSummary.notEnoughData',
  Unknown: 'scoringSummary.notEnoughData',
}

const CONFIDENCE_KEY_MAP = {
  'high confidence': 'scoringSummary.highConfidence',
  'moderate confidence': 'scoringSummary.moderateConfidence',
  'low confidence': 'scoringSummary.lowConfidence',
  'not enough data': 'scoringSummary.notEnoughData',
}

const ADEQUACY_KEY_MAP = {
  high: 'scoringSummary.adequacyHigh',
  medium: 'scoringSummary.adequacyMedium',
  low: 'scoringSummary.adequacyLow',
  'not enough data': 'scoringSummary.notEnoughData',
}

function localizeValue(value, map, t) {
  const key = map[value]
  return key ? t(key) : value
}

function KindSwitch({ activeKind, t }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/80">
      <Link to="/scoring-summary?kind=strategy">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm transition ${
            activeKind === 'strategy' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('scoringSummary.strategyScoringSummary')}
        </button>
      </Link>
      <Link to="/scoring-summary?kind=account">
        <button
          type="button"
          className={`border-l border-slate-700 px-3 py-1.5 text-sm transition ${
            activeKind === 'account' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('scoringSummary.accountScoringSummary')}
        </button>
      </Link>
    </div>
  )
}

function ScoringSummaryPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const rawKind = searchParams.get('kind')
  const kind = rawKind === 'account' ? 'account' : 'strategy'

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.scoringSummary.kind(kind),
    queryFn: () => getScoringSummary(kind),
  })

  const title = useMemo(() => {
    return kind === 'strategy' ? t('scoringSummary.strategyScoringSummary') : t('scoringSummary.accountScoringSummary')
  }, [kind, t])

  if (isLoading) {
    return <LoadingState label={t('scoringSummary.loading')} />
  }

  if (error || !data) {
    return <ErrorState message={t('scoringSummary.error')} />
  }

  const scoreText = data.score === null ? '--' : String(data.score)
  const localizedDecision = localizeValue(data.decision, DECISION_KEY_MAP, t)
  const localizedConfidence = localizeValue(data.confidence, CONFIDENCE_KEY_MAP, t)
  const localizedAdequacy = localizeValue(data.dataAdequacy, ADEQUACY_KEY_MAP, t)

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('scoringSummary.pageTitle')}
        subtitle={t('scoringSummary.pageSubtitle')}
        actions={<KindSwitch activeKind={kind} t={t} />}
      >
        <div className="mb-4 space-y-2">
          <p className="text-sm text-slate-300">{t('scoringSummary.valueProp')}</p>
          <p className="text-xs text-slate-400">{t('scoringSummary.pageDescription')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{title}</p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl font-bold text-cyan-300">{scoreText}</span>
              <span className="mb-1 text-sm text-slate-400">{t('scoringSummary.totalScore')}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">{t('scoringSummary.decision')}</span>
              <Badge tone={toneFromDecision(data.decision)}>{localizedDecision}</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t('scoringSummary.signals')}</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-300">{t('scoringSummary.confidence')}</span>
                <Badge tone={toneFromSignal(data.confidence)}>{localizedConfidence}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-300">{t('scoringSummary.dataAdequacy')}</span>
                <Badge tone={toneFromSignal(data.dataAdequacy)}>{localizedAdequacy}</Badge>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('scoringSummary.strongestFactor')}</p>
                <p className="mt-1 text-sm text-emerald-300">{data.strongestFactor}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('scoringSummary.weakestFactor')}</p>
                <p className="mt-1 text-sm text-rose-300">{data.weakestFactor}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('scoringSummary.keyStrengths')}>
          <ul className="space-y-2 text-sm text-slate-200">
            {(data.keyStrengths || []).length > 0 ? (
              data.keyStrengths.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>)
            ) : (
              <li>• {t('scoringSummary.notEnoughData')}</li>
            )}
          </ul>
        </SectionCard>

        <SectionCard title={t('scoringSummary.keyRisks')}>
          <ul className="space-y-2 text-sm text-slate-200">
            {(data.keyRisks || []).length > 0 ? (
              data.keyRisks.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>)
            ) : (
              <li>• {t('scoringSummary.notEnoughData')}</li>
            )}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title={t('scoringSummary.whyThisResult')}>
        <p className="text-sm leading-6 text-slate-200">{data.explanation || t('scoringSummary.notEnoughData')}</p>
      </SectionCard>

      <SectionCard
        title={t('scoringSummary.recommendedNextStep')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/recommended-actions?kind=${kind}`}>
              <Button variant="secondary">{t('scoringSummary.openRecommendedActions')}</Button>
            </Link>
            <Link to={data.detailPath || (kind === 'strategy' ? '/backtests' : '/account-audit')}>
              <Button variant="secondary">{t('scoringSummary.viewUnderlyingDetail')}</Button>
            </Link>
          </div>
        }
      >
        <p className="text-sm text-slate-200">{data.nextStep || t('scoringSummary.notEnoughData')}</p>
      </SectionCard>
    </div>
  )
}

export default ScoringSummaryPage
