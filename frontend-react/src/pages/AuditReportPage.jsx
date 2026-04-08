import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getAuditReport } from '../services/api/auditReport'
import { getFinalRecommendation } from '../services/api/finalRecommendation'

function toneByVerdict(verdict) {
  if (verdict === 'Qualified') return 'success'
  if (verdict === 'Marginal') return 'warning'
  if (verdict === 'Rejected') return 'danger'
  return 'default'
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
      <Link to="/audit-report?kind=strategy">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm transition ${
            kind === 'strategy' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('auditReport.strategyReport')}
        </button>
      </Link>
      <Link to="/audit-report?kind=account">
        <button
          type="button"
          className={`border-l border-slate-700 px-3 py-1.5 text-sm transition ${
            kind === 'account' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {t('auditReport.accountReport')}
        </button>
      </Link>
    </div>
  )
}

function AuditReportPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const kind = searchParams.get('kind') === 'account' ? 'account' : 'strategy'
  const [exportFeedback, setExportFeedback] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.auditReport.kind(kind),
    queryFn: () => getAuditReport(kind),
  })

  const { data: finalRecommendation } = useQuery({
    queryKey: queryKeys.finalRecommendation.kind(kind),
    queryFn: () => getFinalRecommendation(kind),
  })

  if (isLoading) {
    return <LoadingState label={t('auditReport.loading')} />
  }

  if (error || !data) {
    return <ErrorState message={t('auditReport.error')} />
  }

  const reportTitle = kind === 'strategy' ? t('auditReport.strategyAuditReport') : t('auditReport.accountAuditReport')

  function formatGeneratedAt(raw) {
    if (!raw) return '--'
    const dt = new Date(raw)
    if (Number.isNaN(dt.getTime())) return String(raw)
    return dt.toLocaleString()
  }

  function buildMarkdownReport(report) {
    const final = finalRecommendation
    const lines = []
    lines.push(`# ${reportTitle}`)
    lines.push('')
    lines.push(`- ${t('auditReport.generatedAt')}: ${report.generatedAt || '--'}`)
    lines.push(`- ${t('auditReport.finalStatus')}: ${final?.finalStatus || '--'}`)
    lines.push(`- ${t('auditReport.recommendedNextStep')}: ${final?.recommendedNextStep || report.recommendedNextStep || '--'}`)
    if (report.detailRef) {
      lines.push(`- ${t('auditReport.detailReference')}: ${report.detailRef}`)
    }
    if (report.detailPath) {
      lines.push(`- ${t('auditReport.sourcePath')}: ${report.detailPath}`)
    }
    lines.push('')
    lines.push(`## ${t('auditReport.sectionOverview')}`)
    lines.push('')
    lines.push(`- ${t('auditReport.score')}: ${report.score ?? '--'}`)
    lines.push(`- ${t('auditReport.verdict')}: ${report.verdict || '--'}`)
    lines.push(`- ${t('auditReport.risk')}: ${report.riskLevel || '--'}`)
    lines.push(`- ${t('auditReport.trust')}: ${report.trustLevel || '--'}`)
    lines.push(`- ${t('scoringSummary.decision')}: ${report.decision || '--'}`)
    lines.push('')
    lines.push(`## ${t('auditReport.sectionReasoning')}`)
    lines.push('')
    lines.push(report.whyThisResult || t('auditReport.notEnoughDataFriendly'))
    lines.push('')
    lines.push(`## ${t('auditReport.strengths')}`)
    lines.push('')
    if ((report.strengths || []).length === 0) {
      lines.push(`- ${t('auditReport.notEnoughDataFriendly')}`)
    } else {
      report.strengths.forEach((item) => lines.push(`- ${item}`))
    }
    lines.push('')
    lines.push(`## ${t('auditReport.risks')}`)
    lines.push('')
    if ((report.risks || []).length === 0) {
      lines.push(`- ${t('auditReport.notEnoughDataFriendly')}`)
    } else {
      report.risks.forEach((item) => lines.push(`- ${item}`))
    }
    lines.push('')
    lines.push(`## ${t('auditReport.sectionActions')}`)
    lines.push('')
    if ((report.recommendedActions || []).length === 0) {
      lines.push(`- ${t('auditReport.noAction')}`)
    } else {
      report.recommendedActions.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.title || '--'}`)
        lines.push(`   - ${item.description || ''}`)
        lines.push(`   - ${item.reason || ''}`)
        lines.push(`   - ${t('auditReport.sourcePath')}: ${item.targetPath || '--'}`)
      })
    }
    lines.push('')
    lines.push(`## ${t('auditReport.sectionFinalDecision')}`)
    lines.push('')
    lines.push(`- ${t('auditReport.finalRecommendation')}: ${final?.finalRecommendation || t('auditReport.needsMoreData')}`)
    lines.push(`- ${t('auditReport.finalStatus')}: ${final?.finalStatus || '--'}`)
    lines.push(`- ${t('auditReport.whyThisRecommendation')}: ${final?.whyThisRecommendation || t('auditReport.notEnoughDataFriendly')}`)
    if (final?.reviewerNote) {
      lines.push(`- ${t('auditReport.reviewerNote')}: ${final.reviewerNote}`)
    }
    lines.push(`- ${t('auditReport.decisionSnapshot')}: ${JSON.stringify(final?.decisionSnapshot || {})}`)
    lines.push('')
    lines.push(`### ${t('auditReport.supportingSignals')}`)
    if ((final?.supportingSignals || []).length === 0) {
      lines.push(`- ${t('auditReport.notEnoughDataFriendly')}`)
    } else {
      ;(final.supportingSignals || []).forEach((item) => lines.push(`- ${item}`))
    }
    lines.push('')
    lines.push(`## ${t('auditReport.sectionTimeline')}`)
    lines.push('')
    if ((report.timelineHighlights || []).length === 0) {
      lines.push(`- ${t('auditReport.noTimeline')}`)
    } else {
      report.timelineHighlights.forEach((item) => {
        lines.push(`- ${item.title || '--'} (${item.createdAt || '--'})`)
        lines.push(`  - ${item.description || t('auditReport.noDescription')}`)
      })
    }
    lines.push('')
    return lines.join('\n')
  }

  function downloadMarkdown(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleExportReport() {
    try {
      if (!data) {
        setExportFeedback(t('auditReport.nothingToExport'))
        return
      }
      const markdown = buildMarkdownReport(data)
      if (!markdown.trim()) {
        setExportFeedback(t('auditReport.nothingToExport'))
        return
      }

      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
      const filename = `tradeaudit-${kind}-audit-report-${stamp}.md`

      setExportFeedback(`${t('auditReport.exportReady')}. ${t('auditReport.downloadStarted')}.`)
      downloadMarkdown(filename, markdown)
    } catch {
      setExportFeedback(t('auditReport.exportFailed'))
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={t('auditReport.pageTitle')}
        subtitle={t('auditReport.pageSubtitle')}
        actions={<KindSwitch kind={kind} t={t} />}
      >
        <p className="text-sm text-slate-300">{t('auditReport.pageDescription')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={handleExportReport}>{t('auditReport.exportReport')}</Button>
          <span className="text-xs text-slate-400">{t('auditReport.downloadReport')}</span>
          <span className="text-xs text-slate-500">{t('auditReport.printableReport')}</span>
        </div>
        {exportFeedback ? <p className="mt-2 text-xs text-emerald-300">{exportFeedback}</p> : null}
      </SectionCard>

      <SectionCard title={kind === 'strategy' ? t('auditReport.strategyReport') : t('auditReport.accountReport')}>
        <p className="mb-3 text-xs text-slate-400">{t('auditReport.generatedAt')}: {formatGeneratedAt(data.generatedAt)}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={t('auditReport.score')} value={data.score ?? '--'} />
          <Metric label={t('auditReport.risk')} value={data.riskLevel || '--'} />
          <Metric label={t('auditReport.trust')} value={data.trustLevel || '--'} />
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('auditReport.verdict')}</p>
            <div className="mt-2">
              <Badge tone={toneByVerdict(data.verdict)}>{data.verdict || '--'}</Badge>
            </div>
          </div>
        </div>
        {data.detailRef || data.detailPath ? (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
            {data.detailRef ? <p>{t('auditReport.detailReference')}: {data.detailRef}</p> : null}
            {data.detailPath ? <p>{t('auditReport.sourcePath')}: {data.detailPath}</p> : null}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={t('auditReport.whyThisResult')}>
        <p className="text-sm leading-6 text-slate-200">{data.whyThisResult || t('auditReport.notEnoughDataFriendly')}</p>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('auditReport.strengths')}>
          <ul className="space-y-2 text-sm text-slate-200">
            {(data.strengths || []).length > 0 ? data.strengths.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>) : <li>• {t('auditReport.notEnoughDataFriendly')}</li>}
          </ul>
        </SectionCard>
        <SectionCard title={t('auditReport.risks')}>
          <ul className="space-y-2 text-sm text-slate-200">
            {(data.risks || []).length > 0 ? data.risks.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>) : <li>• {t('auditReport.notEnoughDataFriendly')}</li>}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title={t('auditReport.recommendedActions')}>
        {(data.recommendedActions || []).length > 0 ? (
          <div className="space-y-3">
            {data.recommendedActions.map((item) => (
              <div key={`${item.actionKey}-${item.targetPath}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                <p className="mt-2 text-xs text-slate-400">{item.reason}</p>
                <div className="mt-3">
                  <Link to={item.targetPath || '/dashboard'}>
                    <Button variant="secondary">{t('auditReport.openAction')}</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300">{t('auditReport.noAction')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('auditReport.finalRecommendation')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('auditReport.finalRecommendation')}</p>
            <div className="mt-2">
              <Badge tone={toneByFinalRecommendation(finalRecommendation?.finalRecommendation)}>{finalRecommendation?.finalRecommendation || t('auditReport.needsMoreData')}</Badge>
            </div>
          </div>
          <Metric label={t('auditReport.finalStatus')} value={finalRecommendation?.finalStatus || '--'} />
          <Metric label={t('auditReport.recommendedNextStep')} value={finalRecommendation?.recommendedNextStep || data.recommendedNextStep || '--'} />
        </div>
        <p className="mt-3 text-sm text-slate-200">{t('auditReport.whyThisRecommendation')}: {finalRecommendation?.whyThisRecommendation || t('auditReport.notEnoughDataFriendly')}</p>
        {finalRecommendation?.reviewerNote ? (
          <p className="mt-2 text-sm text-slate-300">{t('auditReport.reviewerNote')}: {finalRecommendation.reviewerNote}</p>
        ) : null}
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">{t('auditReport.supportingSignals')}</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-200">
          {(finalRecommendation?.supportingSignals || []).length > 0
            ? finalRecommendation.supportingSignals.map((item, idx) => <li key={`${item}-${idx}`}>• {item}</li>)
            : <li>• {t('auditReport.notEnoughDataFriendly')}</li>}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          {t('auditReport.decisionSnapshot')}: {finalRecommendation?.decisionSnapshot?.source || '--'}
        </p>
      </SectionCard>

      <SectionCard title={t('auditReport.timelineHighlights')}>
        {(data.timelineHighlights || []).length > 0 ? (
          <ul className="space-y-3">
            {data.timelineHighlights.map((item, idx) => (
              <li key={`${item.eventType}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-sm text-slate-300">{item.description || t('auditReport.noDescription')}</p>
                <p className="mt-2 text-xs text-slate-500">{item.createdAt || '--'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300">{t('auditReport.noTimeline')}</p>
        )}
      </SectionCard>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}

export default AuditReportPage
