import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getComparisonReport } from '../services/api/comparisonReport'
import { getFinalRecommendation } from '../services/api/finalRecommendation'

function winnerTone(winner) {
  if (winner === 'left' || winner === 'right') return 'success'
  return 'warning'
}

function toneByFinalRecommendation(value) {
  if (value === 'Recommended') return 'success'
  if (value === 'Watchlist') return 'warning'
  if (value === 'Needs More Data') return 'warning'
  if (value === 'Not Recommended') return 'danger'
  return 'default'
}

function KindSwitch({ kind, t }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/80">
      <Link to="/comparison-report?kind=strategy">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm transition ${
            kind === 'strategy' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('comparisonReport.compareStrategyReports')}
        </button>
      </Link>
      <Link to="/comparison-report?kind=account">
        <button
          type="button"
          className={`border-l border-slate-700 px-3 py-1.5 text-sm transition ${
            kind === 'account' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('comparisonReport.compareAccountReports')}
        </button>
      </Link>
    </div>
  )
}

function ComparisonReportPage() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = searchParams.get('kind') === 'account' ? 'account' : 'strategy'
  const leftParam = searchParams.get('left') || ''
  const rightParam = searchParams.get('right') || ''

  const [leftInput, setLeftInput] = useState(leftParam)
  const [rightInput, setRightInput] = useState(rightParam)
  const [exportFeedback, setExportFeedback] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.comparisonReport.params(kind, leftParam, rightParam),
    queryFn: () => getComparisonReport(kind, leftParam || undefined, rightParam || undefined),
  })

  const { data: finalRecommendation } = useQuery({
    queryKey: queryKeys.finalRecommendation.kind(kind),
    queryFn: () => getFinalRecommendation(kind),
  })

  const winnerLabel = useMemo(() => {
    if (!data) return '--'
    if (data.winner === 'left') return `${t('comparisonReport.betterChoice')}: ${data.left.label}`
    if (data.winner === 'right') return `${t('comparisonReport.betterChoice')}: ${data.right.label}`
    return t('comparisonReport.resultsAreClose')
  }, [data, t])

  function runCompare() {
    const next = new URLSearchParams(searchParams)
    next.set('kind', kind)
    if (leftInput.trim()) next.set('left', leftInput.trim())
    else next.delete('left')
    if (rightInput.trim()) next.set('right', rightInput.trim())
    else next.delete('right')
    setSearchParams(next)
  }

  function buildMarkdown(payload) {
    const final = finalRecommendation
    const lines = []
    lines.push(`# ${kind === 'strategy' ? t('comparisonReport.strategyComparisonReport') : t('comparisonReport.accountComparisonReport')}`)
    lines.push('')
    lines.push(`- ${t('comparisonReport.comparedObject')}: ${kind}`)
    lines.push(`- ${t('comparisonReport.compareLeftLabel')}: ${payload.left?.label || '--'}`)
    lines.push(`- ${t('comparisonReport.compareRightLabel')}: ${payload.right?.label || '--'}`)
    lines.push(`- ${t('comparisonReport.finalStatus')}: ${final?.finalStatus || '--'}`)
    lines.push('')
    lines.push(`## ${t('comparisonReport.whichIsBetter')}`)
    lines.push(`- ${winnerLabel}`)
    lines.push(`- ${t('comparisonReport.recommendedNextStep')}: ${payload.recommendation || t('comparisonReport.moreDataNeededFriendly')}`)
    lines.push('')
    lines.push(`## ${t('comparisonReport.sectionReasoning')}`)
    lines.push(payload.summaryConclusion || t('comparisonReport.moreDataNeededFriendly'))
    lines.push('')
    lines.push(`### ${t('comparisonReport.keyDifferences')}`)
    ;(payload.keyDifferences || []).forEach((item) => lines.push(`- ${item}`))
    if ((payload.keyDifferences || []).length === 0) lines.push(`- ${t('comparisonReport.moreDataNeededFriendly')}`)
    lines.push('')
    lines.push(`### ${t('comparisonReport.scoreComparison')}`)
    lines.push(`- ${t('comparisonReport.compareLeftLabel')}: ${payload.scoreComparison?.left ?? '--'}`)
    lines.push(`- ${t('comparisonReport.compareRightLabel')}: ${payload.scoreComparison?.right ?? '--'}`)
    lines.push(`- Delta: ${payload.scoreComparison?.delta ?? '--'}`)
    lines.push('')
    lines.push(`### ${t('comparisonReport.riskComparison')}`)
    lines.push(`- ${t('comparisonReport.compareLeftLabel')}: ${payload.riskComparison?.left ?? '--'}`)
    lines.push(`- ${t('comparisonReport.compareRightLabel')}: ${payload.riskComparison?.right ?? '--'}`)
    lines.push('')
    lines.push(`### ${t('comparisonReport.trustComparison')}`)
    lines.push(`- ${t('comparisonReport.compareLeftLabel')}: ${payload.trustComparison?.left ?? '--'}`)
    lines.push(`- ${t('comparisonReport.compareRightLabel')}: ${payload.trustComparison?.right ?? '--'}`)
    if (finalRecommendation) {
      lines.push('')
      lines.push(`## ${t('comparisonReport.sectionFinalDecision')}`)
      lines.push(`- ${t('comparisonReport.finalRecommendation')}: ${final.finalRecommendation || '--'}`)
      lines.push(`- ${t('comparisonReport.finalStatus')}: ${final.finalStatus || '--'}`)
      lines.push(`- ${t('comparisonReport.whyThisRecommendation')}: ${final.whyThisRecommendation || t('comparisonReport.moreDataNeededFriendly')}`)
      if (final.reviewerNote) {
        lines.push(`- ${t('comparisonReport.reviewerNote')}: ${final.reviewerNote}`)
      }
      lines.push(`- ${t('comparisonReport.recommendedNextStep')}: ${final.recommendedNextStep || '--'}`)
      lines.push(`- ${t('comparisonReport.decisionSnapshot')}: ${JSON.stringify(final.decisionSnapshot || {})}`)
      lines.push(`### ${t('comparisonReport.supportingSignals')}`)
      if ((final.supportingSignals || []).length === 0) lines.push(`- ${t('comparisonReport.moreDataNeededFriendly')}`)
      ;(final.supportingSignals || []).forEach((item) => lines.push(`- ${item}`))
    }
    lines.push('')
    return lines.join('\n')
  }

  function exportMarkdown() {
    try {
      if (!data) {
        setExportFeedback(t('auditReport.nothingToExport'))
        return
      }
      const content = buildMarkdown(data)
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
      link.href = url
      link.download = `tradeaudit-${kind}-comparison-report-${stamp}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setExportFeedback(`${t('auditReport.exportReady')}. ${t('auditReport.downloadStarted')}.`)
    } catch {
      setExportFeedback(t('auditReport.exportFailed'))
    }
  }

  if (isLoading) {
    return <LoadingState label={t('comparisonReport.loading')} />
  }

  if (error || !data) {
    return <ErrorState message={t('comparisonReport.error')} />
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('comparisonReport.pageTitle')}
        subtitle={t('comparisonReport.pageSubtitle')}
        actions={<KindSwitch kind={kind} t={t} />}
      >
        <p className="text-sm text-slate-300">{t('comparisonReport.pageDescription')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            {t('comparisonReport.compareLeftId')}
            <input value={leftInput} onChange={(e) => setLeftInput(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" placeholder="left" />
          </label>
          <label className="text-xs text-slate-400">
            {t('comparisonReport.compareRightId')}
            <input value={rightInput} onChange={(e) => setRightInput(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" placeholder="right" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={runCompare}>{t('comparisonReport.runComparison')}</Button>
          <Button variant="secondary" onClick={exportMarkdown}>{t('auditReport.exportReport')}</Button>
        </div>
        {exportFeedback ? <p className="mt-2 text-xs text-emerald-300">{exportFeedback}</p> : null}
      </SectionCard>

      <SectionCard title={t('comparisonReport.whichIsBetter')}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={winnerTone(data.winner)}>{winnerLabel}</Badge>
          <p className="text-sm text-slate-300">{data.recommendation || t('comparisonReport.moreDataNeededFriendly')}</p>
        </div>
      </SectionCard>

      <SectionCard title={t('comparisonReport.whyThisResult')}>
        <p className="text-sm text-slate-200">{data.summaryConclusion || t('comparisonReport.moreDataNeededFriendly')}</p>
      </SectionCard>

      <SectionCard title={t('comparisonReport.keyDifferences')}>
        <ul className="space-y-2 text-sm text-slate-200">
          {(data.keyDifferences || []).length > 0
            ? data.keyDifferences.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>)
            : <li>• {t('comparisonReport.moreDataNeededFriendly')}</li>}
        </ul>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title={t('comparisonReport.scoreComparison')} left={data.scoreComparison?.left} right={data.scoreComparison?.right} />
        <MetricCard title={t('comparisonReport.riskComparison')} left={data.riskComparison?.left} right={data.riskComparison?.right} />
        <MetricCard title={t('comparisonReport.trustComparison')} left={data.trustComparison?.left} right={data.trustComparison?.right} />
      </div>

      <SectionCard title={t('comparisonReport.recommendedNextStep')}>
        <p className="text-sm text-slate-200">{data.recommendation || t('comparisonReport.moreDataNeededFriendly')}</p>
      </SectionCard>

      <SectionCard title={t('comparisonReport.finalRecommendation')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SectionCard title={t('comparisonReport.finalRecommendation')}>
            <div className="flex items-center gap-2 text-sm text-slate-100">
              <Badge tone={toneByFinalRecommendation(finalRecommendation?.finalRecommendation)}>{finalRecommendation?.finalRecommendation || t('comparisonReport.needsMoreData')}</Badge>
            </div>
          </SectionCard>
          <MetricCard title={t('comparisonReport.finalStatus')} left={finalRecommendation?.finalStatus} right={finalRecommendation?.recommendedNextStep} />
          <MetricCard title={t('comparisonReport.decisionSnapshot')} left={finalRecommendation?.decisionSnapshot?.source} right={finalRecommendation?.decisionSnapshot?.latestAction} />
        </div>
        <p className="mt-3 text-sm text-slate-200">{t('comparisonReport.whyThisRecommendation')}: {finalRecommendation?.whyThisRecommendation || t('comparisonReport.moreDataNeededFriendly')}</p>
        {finalRecommendation?.reviewerNote ? (
          <p className="mt-2 text-sm text-slate-300">{t('comparisonReport.reviewerNote')}: {finalRecommendation.reviewerNote}</p>
        ) : null}
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">{t('comparisonReport.supportingSignals')}</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-200">
          {(finalRecommendation?.supportingSignals || []).length > 0
            ? finalRecommendation.supportingSignals.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>)
            : <li>• {t('comparisonReport.moreDataNeededFriendly')}</li>}
        </ul>
      </SectionCard>
    </div>
  )
}

function MetricCard({ title, left, right }) {
  return (
    <SectionCard title={title}>
      <div className="space-y-2 text-sm">
        <p className="text-slate-300">Left: <span className="text-slate-100">{left ?? '--'}</span></p>
        <p className="text-slate-300">Right: <span className="text-slate-100">{right ?? '--'}</span></p>
      </div>
    </SectionCard>
  )
}

export default ComparisonReportPage
