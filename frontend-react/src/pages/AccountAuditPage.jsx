import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import EvaluationSummaryCard from '../components/evaluation/EvaluationSummaryCard'
import SectionCard from '../components/SectionCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import StatCard from '../components/ui/StatCard'
import ActivityTimeline from '../components/ui/ActivityTimeline'
import { useLanguage } from '../i18n/LanguageContext'
import { asText, downloadMarkdown, formatGeneratedAt, timelineLines, toNumberText } from '../lib/exportUtils'
import { queryKeys } from '../lib/queryKeys'
import {
  createAuditManualIntake,
  createMt5Connection,
  createAuditUploadIntake,
  getMt5Connection,
  getMt5Connections,
  getAuditData,
  getAuditIntakeJobs,
  syncMt5Connection,
  testMt5Connection,
  getAccountAuditSummaries,
  recomputeAccountAuditSummary,
  getAccountAuditReview,
} from '../services/api/audit'
import { getEvaluationHistory } from '../services/api/evaluationHistory'
import { getAccountAuditTimeline } from '../services/api/timeline'

const INTAKE_SOURCE_OPTIONS = ['STATEMENT', 'ACCOUNT_HISTORY', 'MANUAL']
const INTAKE_JOBS_LIMIT = 5
const MT5_CONNECTIONS_LIMIT = 10
const SUMMARIES_LIMIT = 20

const SUMMARY_SOURCE_TYPES = [
  { value: null, labelKey: 'accountAudit.summaryFilterAll' },
  { value: 'statement_upload', labelKey: 'accountAudit.summaryFilterStatement' },
  { value: 'account_history_upload', labelKey: 'accountAudit.summaryFilterAccountHistory' },
  { value: 'manual_trade_import', labelKey: 'accountAudit.summaryFilterManual' },
  { value: 'mt5_investor', labelKey: 'accountAudit.summaryFilterMt5' },
]

function formatAuditDate(value, language) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sourceTypeLabel(sourceType, t) {
  if (sourceType === 'STATEMENT') return t('accountAudit.sourceStatement')
  if (sourceType === 'ACCOUNT_HISTORY') return t('accountAudit.sourceAccountHistory')
  return t('accountAudit.sourceManual')
}

function shouldUseZhFallback(text, language) {
  if (language !== 'zh') return false
  if (!text || typeof text !== 'string') return true
  const letters = (text.match(/[A-Za-z]/g) || []).length
  return letters >= 18 && /\b(the|with|for|and|account|risk|score|evaluation|recommended)\b/i.test(text)
}

function AccountAuditPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [sourceType, setSourceType] = useState('STATEMENT')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadFileKey, setUploadFileKey] = useState(0)
  const [manualText, setManualText] = useState('')
  const [note, setNote] = useState('')
  const [intakeResult, setIntakeResult] = useState(null)
  const [intakeError, setIntakeError] = useState('')
  const [mt5Form, setMt5Form] = useState({
    accountNumber: '',
    server: '',
    investorPassword: '',
    connectionLabel: '',
  })
  const [mt5TestResult, setMt5TestResult] = useState(null)
  const [mt5Error, setMt5Error] = useState('')
  const [mt5DetailConnectionId, setMt5DetailConnectionId] = useState(null)
  const [mt5SyncModal, setMt5SyncModal] = useState(null)
  const [mt5SyncPassword, setMt5SyncPassword] = useState('')
  const [summarySourceFilter, setSummarySourceFilter] = useState(null)
  const [summaryDetailItem, setSummaryDetailItem] = useState(null)
  const [reviewDetailItem, setReviewDetailItem] = useState(null)
  const [reviewExportMessage, setReviewExportMessage] = useState('')
  const [summaryExportMessage, setSummaryExportMessage] = useState('')

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.audit.all,
    queryFn: getAuditData,
  })

  const { data: intakeJobs = [] } = useQuery({
    queryKey: queryKeys.audit.intakeJobs(INTAKE_JOBS_LIMIT),
    queryFn: () => getAuditIntakeJobs(INTAKE_JOBS_LIMIT),
  })

  const { data: mt5Connections = [] } = useQuery({
    queryKey: queryKeys.audit.mt5Connections(MT5_CONNECTIONS_LIMIT),
    queryFn: () => getMt5Connections(MT5_CONNECTIONS_LIMIT),
  })

  const { data: auditSummaries = [], refetch: refetchSummaries } = useQuery({
    queryKey: queryKeys.audit.summaries(summarySourceFilter, SUMMARIES_LIMIT),
    queryFn: () => getAccountAuditSummaries(summarySourceFilter, SUMMARIES_LIMIT),
  })

  const {
    data: mt5Detail,
    isLoading: mt5DetailLoading,
    error: mt5DetailError,
  } = useQuery({
    queryKey: queryKeys.audit.mt5Connection(mt5DetailConnectionId ?? 0),
    queryFn: () => getMt5Connection(mt5DetailConnectionId),
    enabled: mt5DetailConnectionId !== null,
  })

  const { data: historyItems = [] } = useQuery({
    queryKey: queryKeys.evaluations.history('account-audit', 'account-main', 5),
    queryFn: () => getEvaluationHistory('account-audit', 'account-main', 5),
    enabled: !!data,
  })

  const {
    data: reviewData,
    isLoading: reviewLoading,
    error: reviewError,
  } = useQuery({
    queryKey: reviewDetailItem
      ? queryKeys.audit.review(reviewDetailItem.sourceType, reviewDetailItem.sourceRefId)
      : [],
    queryFn: () => getAccountAuditReview(reviewDetailItem.sourceType, reviewDetailItem.sourceRefId),
    enabled: reviewDetailItem !== null,
  })

  const {
    data: reviewTimelineData,
    isLoading: reviewTimelineLoading,
  } = useQuery({
    queryKey: reviewDetailItem
      ? queryKeys.audit.timeline(reviewDetailItem.sourceType, reviewDetailItem.sourceRefId, 30)
      : [],
    queryFn: () => getAccountAuditTimeline(reviewDetailItem.sourceType, reviewDetailItem.sourceRefId, 30),
    enabled: reviewDetailItem !== null,
  })

  const uploadMutation = useMutation({
    mutationFn: () => createAuditUploadIntake({ sourceType, file: uploadFile, note }),
    onSuccess: async (result) => {
      setIntakeResult(result)
      setIntakeError('')
      setUploadFile(null)
      setUploadFileKey((value) => value + 1)
      setNote('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.audit.intakeJobs(INTAKE_JOBS_LIMIT) })
    },
    onError: (mutationError) => {
      setIntakeResult(null)
      setIntakeError(mutationError?.details?.error?.message || mutationError?.message || t('accountAudit.intakeError'))
    },
  })

  const manualMutation = useMutation({
    mutationFn: () => createAuditManualIntake({ sourceType: 'MANUAL', manualText, note }),
    onSuccess: async (result) => {
      setIntakeResult(result)
      setIntakeError('')
      setManualText('')
      setNote('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.audit.intakeJobs(INTAKE_JOBS_LIMIT) })
    },
    onError: (mutationError) => {
      setIntakeResult(null)
      setIntakeError(mutationError?.details?.error?.message || mutationError?.message || t('accountAudit.intakeError'))
    },
  })

  const mt5TestMutation = useMutation({
    mutationFn: () => testMt5Connection({
      accountNumber: mt5Form.accountNumber,
      server: mt5Form.server,
      investorPassword: mt5Form.investorPassword,
    }),
    onSuccess: (result) => {
      setMt5TestResult(result)
      setMt5Error('')
    },
    onError: (mutationError) => {
      setMt5TestResult(null)
      setMt5Error(mutationError?.details?.error?.message || mutationError?.message || t('accountAudit.mt5ConnectionFailed'))
    },
  })

  const mt5ConnectMutation = useMutation({
    mutationFn: () => createMt5Connection(mt5Form),
    onSuccess: async (result) => {
      setMt5TestResult(null)
      setMt5Error('')
      setMt5Form({ accountNumber: '', server: '', investorPassword: '', connectionLabel: '' })
      await queryClient.invalidateQueries({ queryKey: queryKeys.audit.mt5Connections(MT5_CONNECTIONS_LIMIT) })
      setMt5DetailConnectionId(result.id)
    },
    onError: (mutationError) => {
      setMt5Error(mutationError?.details?.error?.message || mutationError?.message || t('accountAudit.mt5ConnectionFailed'))
    },
  })

  const mt5SyncMutation = useMutation({
    mutationFn: ({ connectionId, investorPassword }) => syncMt5Connection(connectionId, { investorPassword }),
    onSuccess: async (result) => {
      setMt5Error('')
      setMt5SyncPassword('')
      setMt5SyncModal(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.mt5Connections(MT5_CONNECTIONS_LIMIT) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.mt5Connection(result.id) }),
      ])
      setMt5DetailConnectionId(result.id)
    },
    onError: (mutationError) => {
      setMt5Error(mutationError?.details?.error?.message || mutationError?.message || t('accountAudit.mt5SyncFailed'))
    },
  })

  const recomputeSummaryMutation = useMutation({
    mutationFn: ({ sourceType, sourceRefId }) =>
      recomputeAccountAuditSummary({ sourceType, sourceRefId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.audit.summaries(summarySourceFilter, SUMMARIES_LIMIT),
      })
    },
  })

  const isMt5FormValid =
    mt5Form.accountNumber.trim() && mt5Form.server.trim() && mt5Form.investorPassword.trim()

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

  const displayDecisionReason = shouldUseZhFallback(data.decisionReason, language)
    ? t('accountAudit.fallbackDecisionReason')
    : data.decisionReason
  const displayRecommendedAction = shouldUseZhFallback(data.recommendedAction, language)
    ? t('accountAudit.fallbackRecommendedAction')
    : data.recommendedAction
  const displayExplanation = shouldUseZhFallback(data.explanation, language)
    ? t('accountAudit.fallbackExplanation')
    : data.explanation
  const displayAiExplanation = shouldUseZhFallback(data.aiExplanation, language)
    ? t('accountAudit.fallbackAiExplanation')
    : data.aiExplanation

  const handleExportReview = () => {
    try {
      if (!reviewData) {
        setReviewExportMessage(t('export.nothingToExport'))
        return
      }

      const latestReviewAction = (reviewTimelineData?.items || []).find((item) => item?.event_type === 'review_action_recorded')
      const latestReviewNote = (reviewTimelineData?.items || []).find((item) => item?.event_type === 'review_note_added')

      const lines = [
        `# ${t('export.exportReview')}`,
        '',
        `- ${t('export.generatedAt')}: ${formatGeneratedAt()}`,
        '',
        '## Object',
        `- Source Type: ${asText(reviewDetailItem?.sourceType)}`,
        `- Source Ref ID: ${asText(reviewDetailItem?.sourceRefId)}`,
        `- Source Label: ${asText(reviewData?.sourceInfo?.sourceLabel)}`,
        '',
        '## Current Status / Decision',
        `- Source Status: ${asText(reviewData?.sourceInfo?.status)}`,
        `- Completeness: ${asText(reviewData?.dataCoverage?.completenessNote)}`,
        '',
        '## Summary Metrics',
        `- Total Trades: ${asText(reviewData?.metricsSummary?.totalTrades)}`,
        `- Win Rate: ${toNumberText(reviewData?.metricsSummary?.winRate, 1)}`,
        `- PnL: ${toNumberText(reviewData?.metricsSummary?.pnl, 2)}`,
        `- Max Drawdown: ${toNumberText(reviewData?.metricsSummary?.maxDrawdown, 2)}`,
        `- Profit Factor: ${toNumberText(reviewData?.metricsSummary?.profitFactor, 3)}`,
        '',
        '## Latest Action / Note',
        `- Latest Action: ${asText(latestReviewAction?.description)}`,
        `- Latest Note: ${asText(latestReviewNote?.description)}`,
        '',
        '## Timeline (Recent)',
        ...timelineLines(reviewTimelineData?.items || [], 10),
      ]

      downloadMarkdown(
        `account-audit-review-${asText(reviewDetailItem?.sourceType, 'source')}-${asText(reviewDetailItem?.sourceRefId, 'id')}`,
        `${lines.join('\n')}\n`,
      )
      setReviewExportMessage(t('export.exportReady'))
    } catch {
      setReviewExportMessage(t('export.exportFailed'))
    }
  }

  const handleExportSummary = () => {
    try {
      if (!summaryDetailItem) {
        setSummaryExportMessage(t('export.nothingToExport'))
        return
      }

      const lines = [
        `# ${t('export.exportSummary')}`,
        '',
        `- ${t('export.generatedAt')}: ${formatGeneratedAt()}`,
        '',
        '## Object',
        `- Source Type: ${asText(summaryDetailItem.sourceType)}`,
        `- Source Ref ID: ${asText(summaryDetailItem.sourceRefId)}`,
        `- Account Label: ${asText(summaryDetailItem.accountLabel)}`,
        '',
        '## Summary Metrics',
        `- Total Trades: ${asText(summaryDetailItem.totalTrades)}`,
        `- Win Rate: ${toNumberText(summaryDetailItem.winRate, 1)}`,
        `- PnL: ${toNumberText(summaryDetailItem.pnl, 2)}`,
        `- Max Drawdown: ${toNumberText(summaryDetailItem.maxDrawdown, 2)}`,
        `- Profit Factor: ${toNumberText(summaryDetailItem.profitFactor, 3)}`,
      ]

      downloadMarkdown(`account-audit-summary-${asText(summaryDetailItem.id, 'id')}`, `${lines.join('\n')}\n`)
      setSummaryExportMessage(t('export.exportReady'))
    } catch {
      setSummaryExportMessage(t('export.exportFailed'))
    }
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

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('accountAudit.intakeTitle')}</p>
            <p className="text-xs text-slate-400">{t('accountAudit.intakeSubtitle')}</p>
          </div>
          {uploadMutation.isPending || manualMutation.isPending ? (
            <span className="text-xs text-cyan-300">{t('accountAudit.intaking')}</span>
          ) : null}
        </div>

        <div className="mb-3 rounded-lg border border-sky-800/40 bg-sky-950/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-sky-200">{t('accountAudit.pathGuideTitle')}</p>
          <p className="mt-1 text-xs text-slate-300">{t('accountAudit.pathGuideIntro')}</p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
            <li>{t('accountAudit.pathGuideBacktests')}</li>
            <li>{t('accountAudit.pathGuideAccountAudit')}</li>
            <li>{t('accountAudit.pathGuideMobile')}</li>
          </ul>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{t('accountAudit.sourceTypeTitle')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('accountAudit.sourceTypeSubtitle')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTAKE_SOURCE_OPTIONS.map((option) => {
                const active = sourceType === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSourceType(option)}
                    className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                      active
                        ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                        : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                    }`}
                  >
                    {sourceTypeLabel(option, t)}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {sourceType === 'STATEMENT'
                ? t('accountAudit.statementHint')
                : sourceType === 'ACCOUNT_HISTORY'
                  ? t('accountAudit.accountHistoryHint')
                  : t('accountAudit.manualHint')}
            </p>
          </div>

          <div className="rounded-lg border border-amber-800/40 bg-amber-950/15 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">{t('accountAudit.mobileOnlyTitle')}</p>
            <p className="mt-1 text-xs text-amber-100/80">{t('accountAudit.mobileOnlyDesc')}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <AuditFactPill label={t('accountAudit.mobileOnlyStep1')} value={t('accountAudit.mobileOnlyStep1Desc')} />
              <AuditFactPill label={t('accountAudit.mobileOnlyStep2')} value={t('accountAudit.mobileOnlyStep2Desc')} />
              <AuditFactPill label={t('accountAudit.mobileOnlyStep3')} value={t('accountAudit.mobileOnlyStep3Desc')} />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          {sourceType === 'MANUAL' ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.manualTextLabel')}</span>
                <textarea
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  rows={7}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                  placeholder={t('accountAudit.manualTextPlaceholder')}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.noteLabel')}</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                  placeholder={t('accountAudit.notePlaceholder')}
                />
              </label>
              <Button onClick={() => manualMutation.mutate()} disabled={manualMutation.isPending || !manualText.trim()}>
                {manualMutation.isPending ? t('accountAudit.intaking') : t('accountAudit.manualAction')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 transition hover:border-cyan-700/60">
                <span className="truncate text-sm text-slate-400">
                  {uploadFile ? uploadFile.name : t('accountAudit.uploadChooseFile')}
                </span>
                <input
                  key={uploadFileKey}
                  type="file"
                  accept=".csv,.txt,.html,.htm"
                  className="sr-only"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.noteLabel')}</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                  placeholder={t('accountAudit.notePlaceholder')}
                />
              </label>
              <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !uploadFile}>
                {uploadMutation.isPending ? t('accountAudit.intaking') : t('accountAudit.uploadAction')}
              </Button>
            </div>
          )}
        </div>

        {intakeError ? (
          <p className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{intakeError}</p>
        ) : null}

        {intakeResult ? (
          <div className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/15 p-3 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">{t('accountAudit.intakeSuccessTitle')}</p>
            <p className="mt-1 text-xs text-emerald-100/85">
              {t('accountAudit.intakeSuccessDesc', {
                sourceType: sourceTypeLabel(intakeResult.sourceType, t),
                rows: intakeResult.detectedRows,
              })}
            </p>
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              {t('accountAudit.recentIntakeTitle')}
            </p>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('accountAudit.recentIntakeSubtitle')}</p>
          {intakeJobs.length === 0 ? (
            <p className="text-sm text-slate-400">{t('accountAudit.recentIntakeEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {intakeJobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-700/50 bg-cyan-950/30 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
                        {sourceTypeLabel(job.sourceType, t)}
                      </span>
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/50 px-2 py-0.5 text-[11px] text-slate-300">
                        {job.intakeMethod}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${job.status === 'SUCCESS' ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200' : 'border-rose-700/60 bg-rose-950/30 text-rose-200'}`}>
                      {job.status === 'SUCCESS' ? t('accountAudit.statusSuccess') : t('accountAudit.statusFailed')}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <AuditIntakeMetric label={t('accountAudit.jobSourceLabel')} value={job.sourceLabel || '--'} breakAll />
                    <AuditIntakeMetric label={t('accountAudit.jobFilenameLabel')} value={job.originalFilename || '--'} breakAll />
                    <AuditIntakeMetric label={t('accountAudit.jobRowsLabel')} value={job.detectedRows} />
                    <AuditIntakeMetric label={t('accountAudit.jobCreatedAtLabel')} value={formatAuditDate(job.createdAt, language)} />
                  </div>
                  {job.note ? <p className="mt-2 text-xs text-slate-400">{job.note}</p> : null}
                  {job.errorMessage ? <p className="mt-2 text-xs text-rose-300">{job.errorMessage}</p> : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const sourceTypeMap = {
                          STATEMENT: 'statement_upload',
                          ACCOUNT_HISTORY: 'account_history_upload',
                          MANUAL: 'manual_trade_import',
                        }
                        setReviewDetailItem({
                          sourceType: sourceTypeMap[job.sourceType],
                          sourceRefId: job.id,
                        })
                      }}
                      className="rounded-md border border-amber-700 bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-800"
                    >
                      {t('accountAudit.reviewViewReview')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('accountAudit.mt5Title')}</p>
            <p className="text-xs text-slate-400">{t('accountAudit.mt5Subtitle')}</p>
          </div>
          {(mt5TestMutation.isPending || mt5ConnectMutation.isPending || mt5SyncMutation.isPending) ? (
            <span className="text-xs text-cyan-300">{t('accountAudit.intaking')}</span>
          ) : null}
        </div>

        <div className="mb-3 rounded-lg border border-indigo-800/40 bg-indigo-950/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-indigo-200">{t('accountAudit.mt5ReadOnlyTitle')}</p>
          <p className="mt-1 text-xs text-slate-300">{t('accountAudit.mt5ReadOnlyDesc')}</p>
          <p className="mt-2 text-[11px] text-slate-400">{t('accountAudit.mt5NoTradingDesc')}</p>
          <div className="mt-3 rounded-md border border-indigo-700/30 bg-slate-950/40 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-200">
              {t('accountAudit.mt5HelpTitle')}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              <li>{t('accountAudit.mt5HelpServer')}</li>
              <li>{t('accountAudit.mt5HelpPlatformScope')}</li>
              <li>{t('accountAudit.mt5HelpLabelOptional')}</li>
              <li>{t('accountAudit.mt5HelpCredentials')}</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.mt5AccountNumber')}</span>
            <input
              value={mt5Form.accountNumber}
              onChange={(event) => setMt5Form((prev) => ({ ...prev, accountNumber: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
              placeholder="12345678"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.mt5Server')}</span>
            <input
              value={mt5Form.server}
              onChange={(event) => setMt5Form((prev) => ({ ...prev, server: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
              placeholder={t('accountAudit.mt5ServerPlaceholder')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.mt5InvestorPassword')}</span>
            <input
              type="password"
              value={mt5Form.investorPassword}
              onChange={(event) => setMt5Form((prev) => ({ ...prev, investorPassword: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
              placeholder={t('accountAudit.mt5InvestorPassword')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.mt5ConnectionLabel')}</span>
            <input
              value={mt5Form.connectionLabel}
              onChange={(event) => setMt5Form((prev) => ({ ...prev, connectionLabel: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
              placeholder={t('accountAudit.mt5ConnectionLabelOptional')}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => mt5TestMutation.mutate()} disabled={!isMt5FormValid || mt5TestMutation.isPending}>
            {mt5TestMutation.isPending ? t('accountAudit.mt5Testing') : t('accountAudit.mt5TestConnection')}
          </Button>
          <Button onClick={() => mt5ConnectMutation.mutate()} disabled={!isMt5FormValid || mt5ConnectMutation.isPending}>
            {mt5ConnectMutation.isPending ? t('accountAudit.mt5Connecting') : t('accountAudit.mt5ConnectAction')}
          </Button>
        </div>

        {mt5Error ? (
          <p className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{mt5Error}</p>
        ) : null}

        {mt5TestResult ? (
          <div className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-200">{t('accountAudit.mt5ConnectionSuccessful')}</p>
              <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-200">
                {t('accountAudit.mt5ReadOnlyAccess')}
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-100/85">{mt5TestResult.message}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <AuditIntakeMetric label={t('accountAudit.mt5AccountNumber')} value={mt5TestResult.accountInfo.accountNumber} />
              <AuditIntakeMetric label={t('accountAudit.mt5Server')} value={mt5TestResult.accountInfo.server} />
              <AuditIntakeMetric label={t('accountAudit.balance')} value={mt5TestResult.accountInfo.balance.toFixed(2)} />
              <AuditIntakeMetric label={t('accountAudit.equity')} value={mt5TestResult.accountInfo.equity.toFixed(2)} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              {t('accountAudit.mt5RecentConnectionsTitle')}
            </p>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('accountAudit.mt5RecentConnectionsSubtitle')}</p>
          {mt5Connections.length === 0 ? (
            <p className="text-sm text-slate-400">{t('accountAudit.mt5RecentConnectionsEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {mt5Connections.map((connection) => (
                <div key={connection.id} className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-700/50 bg-indigo-950/30 px-2 py-0.5 text-[11px] font-medium text-indigo-200">
                        {connection.connectionLabel}
                      </span>
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/50 px-2 py-0.5 text-[11px] text-slate-300">
                        {t('accountAudit.mt5ReadOnlyAccess')}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${connection.status === 'SYNCED' || connection.status === 'CONNECTED' ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200' : 'border-rose-700/60 bg-rose-950/30 text-rose-200'}`}>
                      {connection.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <AuditIntakeMetric label={t('accountAudit.mt5AccountNumber')} value={connection.accountNumber} />
                    <AuditIntakeMetric label={t('accountAudit.mt5Server')} value={connection.server} />
                    <AuditIntakeMetric label={t('accountAudit.mt5LastTested')} value={formatAuditDate(connection.lastTestedAt, language)} />
                    <AuditIntakeMetric label={t('accountAudit.mt5LastSynced')} value={formatAuditDate(connection.lastSyncedAt, language)} />
                    <AuditIntakeMetric label={t('accountAudit.mt5TradesCount')} value={connection.syncedTradeCount} />
                  </div>
                  {connection.errorMessage ? <p className="mt-2 text-xs text-rose-300">{connection.errorMessage}</p> : null}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMt5DetailConnectionId(connection.id)}
                      className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                    >
                      {t('accountAudit.mt5ViewDetails')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMt5SyncModal(connection)}
                      className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-950/50"
                    >
                      {t('accountAudit.mt5SyncNow')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        recomputeSummaryMutation.mutate({
                          sourceType: 'mt5_investor',
                          sourceRefId: connection.id,
                        })
                      }
                      disabled={
                        recomputeSummaryMutation.isPending &&
                        recomputeSummaryMutation.variables?.sourceRefId === connection.id
                      }
                      className="rounded-md border border-violet-700/50 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-950/50 disabled:opacity-50"
                    >
                      {recomputeSummaryMutation.isPending &&
                      recomputeSummaryMutation.variables?.sourceRefId === connection.id
                        ? t('accountAudit.summaryRecomputing')
                        : t('accountAudit.summaryRecompute')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewDetailItem({
                          sourceType: 'mt5_investor',
                          sourceRefId: connection.id,
                        })
                      }
                      className="rounded-md border border-amber-700 bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-800"
                    >
                      {t('accountAudit.reviewViewReview')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Account Audit Summaries */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{t('accountAudit.summaryTitle')}</p>
                    <p className="text-xs text-slate-400">{t('accountAudit.summarySubtitle')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchSummaries()}
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                  >
                    {t('common.refresh')}
                  </button>
                </div>

                {/* Source type filter */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUMMARY_SOURCE_TYPES.map(({ value, labelKey }) => {
                    const active = summarySourceFilter === value
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setSummarySourceFilter(value)}
                        className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition ${
                          active
                            ? 'border-violet-700/60 bg-violet-950/30 text-violet-200'
                            : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    )
                  })}
                </div>

                {auditSummaries.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('accountAudit.summaryEmpty')}</p>
                ) : (
                  <div className="space-y-2">
                    {auditSummaries.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 text-xs text-slate-300">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-violet-700/50 bg-violet-950/30 px-2 py-0.5 text-[11px] font-medium text-violet-200">
                              {item.accountLabel}
                            </span>
                            <span className="rounded-full border border-slate-700/50 bg-slate-950/50 px-2 py-0.5 text-[11px] text-slate-300">
                              {item.sourceType}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {t('accountAudit.summaryLastComputed')}: {formatAuditDate(item.lastComputedAt, language)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          <AuditIntakeMetric label={t('accountAudit.summaryTotalTrades')} value={item.totalTrades ?? '--'} />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryWinRate')}
                            value={item.winRate !== null ? `${item.winRate.toFixed(1)}%` : '--'}
                          />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryPnl')}
                            value={item.pnl !== null ? item.pnl.toFixed(2) : '--'}
                          />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryMaxDrawdown')}
                            value={item.maxDrawdown !== null ? item.maxDrawdown.toFixed(2) : '--'}
                          />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryProfitFactor')}
                            value={item.profitFactor !== null ? item.profitFactor.toFixed(3) : '--'}
                          />
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryExpectancy')}
                            value={item.expectancy !== null ? item.expectancy.toFixed(3) : '--'}
                          />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryAvgHoldingTime')}
                            value={item.averageHoldingTime !== null ? `${item.averageHoldingTime.toFixed(1)}h` : '--'}
                          />
                          <AuditIntakeMetric
                            label={t('accountAudit.summaryCoveredPeriod')}
                            value={
                              item.periodStart && item.periodEnd
                                ? `${formatAuditDate(item.periodStart, language)} → ${formatAuditDate(item.periodEnd, language)}`
                                : '--'
                            }
                            breakAll
                          />
                          <AuditIntakeMetric label={t('accountAudit.summarySourceType')} value={item.sourceType} />
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSummaryDetailItem(item)}
                              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                            >
                              {t('accountAudit.summaryViewSummary')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewDetailItem({ sourceType: item.sourceType, sourceRefId: item.sourceRefId })}
                              className="flex-1 rounded-md border border-amber-700 bg-amber-900 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-800"
                            >
                              {t('accountAudit.reviewViewReview')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </section>

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
        decisionReason={displayDecisionReason}
        recommendedAction={displayRecommendedAction}
        explanation={displayExplanation}
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
          <p className="text-sm leading-7 text-slate-300">{displayAiExplanation}</p>
        </SectionCard>
      </div>

      {mt5SyncModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <h3 className="text-base font-semibold text-slate-100">{t('accountAudit.mt5SyncNow')}</h3>
            <p className="mt-1 text-xs text-slate-400">{mt5SyncModal.connectionLabel}</p>
            <p className="mt-3 text-sm text-slate-300">{t('accountAudit.mt5SyncPasswordHint')}</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-400">{t('accountAudit.mt5InvestorPassword')}</span>
              <input
                type="password"
                value={mt5SyncPassword}
                onChange={(event) => setMt5SyncPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setMt5SyncModal(null); setMt5SyncPassword('') }}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('backtests.lifecycleClose')}
              </button>
              <button
                type="button"
                onClick={() => mt5SyncMutation.mutate({ connectionId: mt5SyncModal.id, investorPassword: mt5SyncPassword || undefined })}
                className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-950/50"
              >
                {mt5SyncMutation.isPending ? t('accountAudit.mt5Syncing') : t('accountAudit.mt5SyncNow')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {summaryDetailItem ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setSummaryDetailItem(null) }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">{t('accountAudit.summaryTitle')}</p>
                <p className="mt-1 text-xs text-slate-500">{summaryDetailItem.accountLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportSummary}
                  className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-900/30"
                >
                  {t('export.exportSummary')}
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryDetailItem(null)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              {summaryExportMessage ? <p className="mb-3 text-xs text-emerald-300">{summaryExportMessage}</p> : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <AuditIntakeMetric label={t('accountAudit.summarySourceType')} value={summaryDetailItem.sourceType} />
                <AuditIntakeMetric label={t('accountAudit.summaryTotalTrades')} value={summaryDetailItem.totalTrades ?? '--'} />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryWinRate')}
                  value={summaryDetailItem.winRate !== null ? `${summaryDetailItem.winRate.toFixed(1)}%` : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryPnl')}
                  value={summaryDetailItem.pnl !== null ? summaryDetailItem.pnl.toFixed(2) : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryMaxDrawdown')}
                  value={summaryDetailItem.maxDrawdown !== null ? summaryDetailItem.maxDrawdown.toFixed(2) : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryProfitFactor')}
                  value={summaryDetailItem.profitFactor !== null ? summaryDetailItem.profitFactor.toFixed(3) : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryExpectancy')}
                  value={summaryDetailItem.expectancy !== null ? summaryDetailItem.expectancy.toFixed(3) : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryAvgHoldingTime')}
                  value={summaryDetailItem.averageHoldingTime !== null ? `${summaryDetailItem.averageHoldingTime.toFixed(1)}h` : '--'}
                />
                <AuditIntakeMetric
                  label={t('accountAudit.summaryCoveredPeriod')}
                  value={
                    summaryDetailItem.periodStart && summaryDetailItem.periodEnd
                      ? `${formatAuditDate(summaryDetailItem.periodStart, language)} → ${formatAuditDate(summaryDetailItem.periodEnd, language)}`
                      : '--'
                  }
                  breakAll
                />
              </div>
              <p className="mt-4 text-[11px] text-slate-500">
                {t('accountAudit.summaryLastComputed')}: {formatAuditDate(summaryDetailItem.lastComputedAt, language)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {mt5DetailConnectionId !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setMt5DetailConnectionId(null) }}
        >
          <div className="w-full max-w-5xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">{t('accountAudit.mt5ViewDetails')}</p>
                <p className="mt-1 text-xs text-slate-500">#{mt5DetailConnectionId}</p>
              </div>
              <button
                type="button"
                onClick={() => setMt5DetailConnectionId(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              {mt5DetailLoading ? <p className="text-sm text-slate-400">{t('accountAudit.mt5DetailLoading')}</p> : null}
              {mt5DetailError ? <p className="text-sm text-rose-300">{t('accountAudit.mt5DetailError')}</p> : null}
              {mt5Detail ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <AuditIntakeMetric label={t('accountAudit.mt5ConnectionLabel')} value={mt5Detail.connectionLabel} />
                    <AuditIntakeMetric label={t('accountAudit.mt5AccountNumber')} value={mt5Detail.accountNumber} />
                    <AuditIntakeMetric label={t('accountAudit.mt5Server')} value={mt5Detail.server} />
                    <AuditIntakeMetric label={t('accountAudit.mt5ProviderMode')} value={mt5Detail.providerMode || '--'} />
                    <AuditIntakeMetric label={t('accountAudit.balance')} value={mt5Detail.accountInfo.balance.toFixed(2)} />
                    <AuditIntakeMetric label={t('accountAudit.equity')} value={mt5Detail.accountInfo.equity.toFixed(2)} />
                    <AuditIntakeMetric label={t('accountAudit.mt5Currency')} value={mt5Detail.accountInfo.currency || '--'} />
                    <AuditIntakeMetric label={t('accountAudit.mt5Leverage')} value={mt5Detail.accountInfo.leverage || '--'} />
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{t('accountAudit.mt5RecentTradesTitle')}</p>
                    {mt5Detail.recentTrades && mt5Detail.recentTrades.length > 0 ? (
                      <div className="overflow-x-auto pb-1">
                        <table className="min-w-[900px] w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
                              <th className="pb-2 pr-3">Ticket</th>
                              <th className="pb-2 pr-3">Symbol</th>
                              <th className="pb-2 pr-3">Type</th>
                              <th className="pb-2 pr-3 text-right">Volume</th>
                              <th className="pb-2 pr-3">Close Time</th>
                              <th className="pb-2 pr-3 text-right">Profit</th>
                              <th className="pb-2">Comment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {mt5Detail.recentTrades.map((trade, index) => (
                              <tr key={`${trade.ticket}-${index}`} className="text-slate-300">
                                <td className="py-2 pr-3">{trade.ticket}</td>
                                <td className="py-2 pr-3">{trade.symbol}</td>
                                <td className="py-2 pr-3">{trade.orderType}</td>
                                <td className="py-2 pr-3 text-right">{trade.volume}</td>
                                <td className="py-2 pr-3">{formatAuditDate(trade.closeTime, language)}</td>
                                <td className={`py-2 pr-3 text-right ${trade.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.profit.toFixed(2)}</td>
                                <td className="py-2">{trade.comment || '--'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">{t('accountAudit.mt5RecentTradesEmpty')}</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reviewDetailItem ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) setReviewDetailItem(null) }}
        >
          <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sticky top-0 bg-slate-900">
              <div>
                <p className="text-sm font-semibold text-slate-100">{t('accountAudit.reviewTitle')}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {reviewDetailItem?.sourceType} #{reviewDetailItem?.sourceRefId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReview}
                  className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-900/30"
                >
                  {t('export.exportReview')}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDetailItem(null)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              {reviewExportMessage ? <p className="mb-3 text-xs text-emerald-300">{reviewExportMessage}</p> : null}
              {reviewLoading ? (
                <p className="text-sm text-slate-400">{t('common.loading')}</p>
              ) : reviewError ? (
                <p className="text-sm text-rose-300">{t('accountAudit.reviewLoadingError')}</p>
              ) : !reviewData ? (
                <p className="text-sm text-slate-400">{t('accountAudit.reviewNoData')}</p>
              ) : (
                <>
                  {/* Source Info */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 mb-2">
                      {t('accountAudit.reviewSourceInfoSection')}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <AuditIntakeMetric label={t('accountAudit.reviewSourceType')} value={reviewData.sourceInfo?.sourceType || '--'} />
                      <AuditIntakeMetric label={t('accountAudit.reviewSourceLabel')} value={reviewData.sourceInfo?.sourceLabel || '--'} breakAll />
                      {reviewData.sourceInfo?.accountNumber && (
                        <AuditIntakeMetric label={t('accountAudit.reviewAccountNumber')} value={reviewData.sourceInfo.accountNumber} />
                      )}
                      {reviewData.sourceInfo?.server && (
                        <AuditIntakeMetric label={t('accountAudit.reviewServer')} value={reviewData.sourceInfo.server} />
                      )}
                      {reviewData.sourceInfo?.status && (
                        <AuditIntakeMetric label={t('accountAudit.reviewStatus')} value={reviewData.sourceInfo.status} />
                      )}
                      {reviewData.sourceInfo?.lastSyncedAt && (
                        <AuditIntakeMetric label={t('accountAudit.reviewLastSyncedAt')} value={formatAuditDate(reviewData.sourceInfo.lastSyncedAt, language)} />
                      )}
                    </div>
                  </div>

                  {/* Account Info */}
                  {reviewData.accountInfo ? (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 mb-2">
                        {t('accountAudit.reviewAccountInfoSection')}
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <AuditIntakeMetric label={t('accountAudit.reviewAccountNumber')} value={reviewData.accountInfo.accountNumber} />
                        <AuditIntakeMetric label={t('accountAudit.reviewServer')} value={reviewData.accountInfo.server} />
                        <AuditIntakeMetric label={t('accountAudit.reviewAccountName')} value={reviewData.accountInfo.accountName || '--'} />
                        <AuditIntakeMetric label={t('accountAudit.reviewCurrency')} value={reviewData.accountInfo.currency || '--'} />
                        <AuditIntakeMetric label={t('accountAudit.reviewBalance')} value={reviewData.accountInfo.balance?.toFixed(2) || '--'} />
                        <AuditIntakeMetric label={t('accountAudit.reviewEquity')} value={reviewData.accountInfo.equity?.toFixed(2) || '--'} />
                        <AuditIntakeMetric label={t('accountAudit.reviewLeverage')} value={reviewData.accountInfo.leverage || '--'} />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400">{t('accountAudit.reviewNoAccountInfo')}</p>
                    </div>
                  )}

                  {/* Metrics Summary */}
                  {reviewData.metricsSummary ? (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 mb-2">
                        {t('accountAudit.reviewMetricsSummarySection')}
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <AuditIntakeMetric label={t('accountAudit.reviewTotalTrades')} value={reviewData.metricsSummary.totalTrades ?? '--'} />
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewWinRate')}
                          value={reviewData.metricsSummary.winRate !== null ? `${reviewData.metricsSummary.winRate.toFixed(1)}%` : '--'}
                        />
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewPnl')}
                          value={reviewData.metricsSummary.pnl !== null ? reviewData.metricsSummary.pnl.toFixed(2) : '--'}
                        />
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewMaxDrawdown')}
                          value={reviewData.metricsSummary.maxDrawdown !== null ? reviewData.metricsSummary.maxDrawdown.toFixed(2) : '--'}
                        />
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewProfitFactor')}
                          value={reviewData.metricsSummary.profitFactor !== null ? reviewData.metricsSummary.profitFactor.toFixed(3) : '--'}
                        />
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewExpectancy')}
                          value={reviewData.metricsSummary.expectancy !== null ? reviewData.metricsSummary.expectancy.toFixed(3) : '--'}
                        />
                      </div>
                      {reviewData.metricsSummary.lastComputedAt && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          {t('accountAudit.reviewLastComputed')}: {formatAuditDate(reviewData.metricsSummary.lastComputedAt, language)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400">{t('accountAudit.reviewNoSummaryYet')}</p>
                    </div>
                  )}

                  {/* Recent Trades */}
                  {reviewData.recentTrades && reviewData.recentTrades.length > 0 ? (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 mb-2">
                        {t('accountAudit.reviewRecentTradesSection')}
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/50 pb-1">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
                              <th className="px-3 py-2">Ticket</th>
                              <th className="px-3 py-2">{t('accountAudit.reviewTradeSymbol')}</th>
                              <th className="px-3 py-2">{t('accountAudit.reviewTradeType')}</th>
                              <th className="px-3 py-2 text-right">{t('accountAudit.reviewTradeVolume')}</th>
                              <th className="px-3 py-2">{t('accountAudit.reviewTradeOpenTime')}</th>
                              <th className="px-3 py-2">{t('accountAudit.reviewTradeCloseTime')}</th>
                              <th className="px-3 py-2 text-right">{t('accountAudit.reviewTradePnl')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {reviewData.recentTrades.map((trade, index) => (
                              <tr key={`${trade.ticket}-${index}`} className="text-slate-300">
                                <td className="px-3 py-2 text-xs">{trade.ticket}</td>
                                <td className="px-3 py-2 text-xs">{trade.symbol}</td>
                                <td className="px-3 py-2 text-xs">{trade.orderType}</td>
                                <td className="px-3 py-2 text-right text-xs">{trade.volume}</td>
                                <td className="px-3 py-2 text-xs">{formatAuditDate(trade.openTime, language)}</td>
                                <td className="px-3 py-2 text-xs">{formatAuditDate(trade.closeTime, language)}</td>
                                <td className={`px-3 py-2 text-right text-xs ${(trade.profit + trade.commission + trade.swap) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {(trade.profit + trade.commission + trade.swap).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400">{t('accountAudit.reviewNoTradesYet')}</p>
                    </div>
                  )}

                  {/* Data Coverage */}
                  {reviewData.dataCoverage && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 mb-2">
                        {t('accountAudit.reviewDataCoverageSection')}
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <AuditIntakeMetric label={t('accountAudit.reviewTradeCount')} value={reviewData.dataCoverage.tradeCount} />
                        {reviewData.dataCoverage.coveredPeriod && (
                          <AuditIntakeMetric
                            label={t('accountAudit.reviewCoveredPeriod')}
                            value={
                              reviewData.dataCoverage.coveredPeriod.start && reviewData.dataCoverage.coveredPeriod.end
                                ? `${formatAuditDate(reviewData.dataCoverage.coveredPeriod.start, language).split(' ')[0]} → ${formatAuditDate(reviewData.dataCoverage.coveredPeriod.end, language).split(' ')[0]}`
                                : '--'
                            }
                            breakAll
                          />
                        )}
                        {reviewData.dataCoverage.lastSyncOrUpload && (
                          <AuditIntakeMetric
                            label={t('accountAudit.reviewLastUpload')}
                            value={formatAuditDate(reviewData.dataCoverage.lastSyncOrUpload, language)}
                          />
                        )}
                        <AuditIntakeMetric
                          label={t('accountAudit.reviewCompletenessNote')}
                          value={reviewData.dataCoverage.completenessNote}
                          breakAll
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <ActivityTimeline
                      title={t('timeline.activityTimeline')}
                      items={reviewTimelineData?.items || []}
                      isLoading={reviewTimelineLoading}
                      t={t}
                      language={language}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AuditFactPill({ label, value }) {
  return (
    <div className="rounded-md border border-amber-800/40 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-amber-200/80">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  )
}

function AuditIntakeMetric({ label, value, breakAll = false }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium text-slate-100 ${breakAll ? 'break-all' : ''}`}>{value}</p>
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
