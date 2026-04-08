import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment } from 'react'
import { useState } from 'react'
import Badge from '../components/ui/Badge'
import EvaluationSummaryCard from '../components/evaluation/EvaluationSummaryCard'
import DecisionBadge from '../components/evaluation/DecisionBadge'
import ScoreBreakdownCard from '../components/evaluation/ScoreBreakdownCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import TableShell from '../components/ui/TableShell'
import ActivityTimeline from '../components/ui/ActivityTimeline'
import { useLanguage } from '../i18n/LanguageContext'
import { asText, downloadMarkdown, formatGeneratedAt, timelineLines, toNumberText } from '../lib/exportUtils'
import { queryKeys } from '../lib/queryKeys'
import {
  activateImportJob,
  compareImportJobs,
  getActiveDataset,
  getBacktestsData,
  getImportJobChanges,
  getStrategyLifecycle,
  markBacktestCandidate,
  getRecentImportJobs,
  importBacktestsCsv,
  importBacktestsCsvUpload,
  unmarkBacktestCandidate,
} from '../services/api/backtests'
import { getEvaluationHistory } from '../services/api/evaluationHistory'
import { createForwardRun } from '../services/api/forwardRuns'
import { getStrategyTimeline } from '../services/api/timeline'

const PAGE_SIZE = 5
const DEFAULT_IMPORT_PATH = 'backend/data_sources/backtests.csv'
const SMOKE_IMPORT_PATH = 'backend/data_sources/stage13_smoke_mixed.csv'
const IMPORT_JOBS_LIMIT = 5
const IMPORT_MODE = 'replace'

const IMPORT_SOURCE_OPTIONS = [
  { key: 'default', labelKey: 'backtests.sourceDefault', path: DEFAULT_IMPORT_PATH },
  { key: 'smoke', labelKey: 'backtests.sourceSmoke', path: SMOKE_IMPORT_PATH },
  { key: 'custom', labelKey: 'backtests.sourceCustom', path: null },
]

function formatImportJobDate(value, language) {
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

function resolveImportJobStatusLabel(status, t) {
  return status === 'success'
    ? t('backtests.jobStatusSuccess')
    : t('backtests.jobStatusFailed')
}

function buildImportSummary(result, t) {
  if (!result) return ''
  if (result.failedCount > 0) {
    return t('backtests.importSummaryPartial', {
      failed: result.failedCount,
      invalid: result.invalidRowCount,
    })
  }
  if (result.invalidRowCount > 0) {
    return t('backtests.importSummaryInvalid', {
      invalid: result.invalidRowCount,
    })
  }
  return t('backtests.importSummarySuccess')
}

function resolveImportSourceByPath(path) {
  const matched = IMPORT_SOURCE_OPTIONS.find((item) => item.path === path)
  return matched ? matched.key : 'custom'
}

function deriveActiveDataset(importJobs) {
  if (!Array.isArray(importJobs) || importJobs.length === 0) return null
  return importJobs.find((job) => job.status === 'success') ?? null
}

function getImportErrorMessage(error, t) {
  if (!error || typeof error !== 'object') {
    return t('backtests.importError')
  }

  const details = error.details
  if (
    details &&
    typeof details === 'object' &&
    details.error &&
    typeof details.error === 'object' &&
    typeof details.error.message === 'string'
  ) {
    return details.error.message
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return t('backtests.importError')
}

function getApiErrorMessage(error, fallbackMessage) {
  if (!error || typeof error !== 'object') {
    return fallbackMessage
  }

  const details = error.details
  if (
    details &&
    typeof details === 'object' &&
    details.error &&
    typeof details.error === 'object' &&
    typeof details.error.message === 'string'
  ) {
    return details.error.message
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

function BacktestsPage() {
  const { t, language } = useLanguage()
  const [page, setPage] = useState(1)
  const [importPath, setImportPath] = useState(DEFAULT_IMPORT_PATH)
  const [importSource, setImportSource] = useState(resolveImportSourceByPath(DEFAULT_IMPORT_PATH))
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadFileKey, setUploadFileKey] = useState(0)
  const [changesJobId, setChangesJobId] = useState(null)
  const [confirmActivateJobId, setConfirmActivateJobId] = useState(null)
  const [activateResult, setActivateResult] = useState(null)
  const [compareSelectedJobIds, setCompareSelectedJobIds] = useState([])
  const [compareModalJobs, setCompareModalJobs] = useState(null)
  const [candidateOnly, setCandidateOnly] = useState(false)
  const [candidateActionStrategyId, setCandidateActionStrategyId] = useState(null)
  const [createRunRow, setCreateRunRow] = useState(null)
  const [createRunSymbol, setCreateRunSymbol] = useState('')
  const [createRunTimeframe, setCreateRunTimeframe] = useState('')
  const [createRunNote, setCreateRunNote] = useState('')
  const [forwardRunResult, setForwardRunResult] = useState(null)
  const [forwardRunActionStrategyId, setForwardRunActionStrategyId] = useState(null)
  const [lifecycleRow, setLifecycleRow] = useState(null)
  const queryClient = useQueryClient()

  const breakdownLabels = {
    returnPct: t('backtests.returnPct'),
    maxDrawdown: t('backtests.maxDd'),
    profitFactor: t('backtests.pf'),
    winRate: t('backtests.winRate'),
    tradeCount: t('backtests.tradeCount'),
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.backtests.list(page, PAGE_SIZE, candidateOnly),
    queryFn: () => getBacktestsData(page, PAGE_SIZE, candidateOnly),
    placeholderData: (prev) => prev,
  })

  const { data: importJobs = [], isLoading: isImportJobsLoading } = useQuery({
    queryKey: queryKeys.importJobs.recent(IMPORT_JOBS_LIMIT),
    queryFn: () => getRecentImportJobs(IMPORT_JOBS_LIMIT),
  })

  const { data: activeDatasetInfo } = useQuery({
    queryKey: queryKeys.backtests.activeDataset,
    queryFn: getActiveDataset,
  })
  const activeSourceJobId = activeDatasetInfo?.sourceJobId ?? null
  const lifecycleStrategyId = lifecycleRow?.id ?? ''

  const {
    data: lifecycleData,
    isLoading: isLifecycleLoading,
    error: lifecycleError,
  } = useQuery({
    queryKey: queryKeys.backtests.lifecycle(lifecycleStrategyId),
    queryFn: () => getStrategyLifecycle(lifecycleStrategyId),
    enabled: Boolean(lifecycleRow?.id),
  })

  const {
    data: strategyTimelineData,
    isLoading: isStrategyTimelineLoading,
  } = useQuery({
    queryKey: queryKeys.backtests.timeline(lifecycleStrategyId, 30),
    queryFn: () => getStrategyTimeline(lifecycleStrategyId, 30),
    enabled: Boolean(lifecycleRow?.id),
  })

  const importMutation = useMutation({
    mutationFn: () => importBacktestsCsv(importPath, IMPORT_MODE),
    onSuccess: async (result) => {
      setImportResult(result)
      setImportError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: ['evaluations', 'history'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.importJobs.recent(IMPORT_JOBS_LIMIT) }),
      ])
    },
    onError: (mutationError) => {
      setImportResult(null)
      setImportError(getImportErrorMessage(mutationError, t))
    },
  })

  const uploadMutation = useMutation({
    mutationFn: () => importBacktestsCsvUpload(uploadFile),
    onSuccess: async (result) => {
      setImportResult(result)
      setImportError('')
      setUploadFile(null)
      setUploadFileKey((k) => k + 1)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: ['evaluations', 'history'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.importJobs.recent(IMPORT_JOBS_LIMIT) }),
      ])
    },
    onError: (mutationError) => {
      setImportResult(null)
      setImportError(getImportErrorMessage(mutationError, t))
    },
  })

  const activateMutation = useMutation({
    mutationFn: (jobId) => activateImportJob(jobId),
    onSuccess: async () => {
      setConfirmActivateJobId(null)
      setActivateResult({ ok: true, message: t('backtests.activateSuccess') })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backtests.activeDataset }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.importJobs.recent(IMPORT_JOBS_LIMIT) }),
      ])
    },
    onError: () => {
      setConfirmActivateJobId(null)
      setActivateResult({ ok: false, message: t('backtests.activateError') })
    },
  })

  const candidateMutation = useMutation({
    mutationFn: ({ strategyId, nextIsCandidate }) =>
      nextIsCandidate ? markBacktestCandidate(strategyId) : unmarkBacktestCandidate(strategyId),
    onMutate: ({ strategyId }) => {
      setCandidateActionStrategyId(strategyId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all })
    },
    onSettled: () => {
      setCandidateActionStrategyId(null)
    },
  })

  const createForwardRunMutation = useMutation({
    mutationFn: ({ strategyId, symbol, timeframe, note }) =>
      createForwardRun({ strategyId, symbol, timeframe, note }),
    onMutate: ({ strategyId }) => {
      setForwardRunActionStrategyId(strategyId)
    },
    onSuccess: async () => {
      setCreateRunRow(null)
      setCreateRunSymbol('')
      setCreateRunTimeframe('')
      setCreateRunNote('')
      setForwardRunResult({ ok: true, message: t('backtests.forwardRunCreated') })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.forwardRuns.all }),
      ])
    },
    onError: (mutationError) => {
      setForwardRunResult({
        ok: false,
        message: getApiErrorMessage(mutationError, t('backtests.forwardRunCreateError')),
      })
    },
    onSettled: () => {
      setForwardRunActionStrategyId(null)
    },
  })

  const selectedSource = IMPORT_SOURCE_OPTIONS.find((item) => item.key === importSource)
  const importSummary = buildImportSummary(importResult, t)
  const activeDataset = activeSourceJobId
    ? (importJobs.find((j) => j.id === activeSourceJobId) ?? deriveActiveDataset(importJobs))
    : deriveActiveDataset(importJobs)

  const handleImportSourceChange = (event) => {
    const nextSource = event.target.value
    setImportSource(nextSource)
    const matched = IMPORT_SOURCE_OPTIONS.find((item) => item.key === nextSource)
    if (matched?.path) {
      setImportPath(matched.path)
    }
  }

  const handleImportPathChange = (event) => {
    const nextPath = event.target.value
    setImportPath(nextPath)
    setImportSource(resolveImportSourceByPath(nextPath))
  }

  const handleCandidateFilterChange = (nextValue) => {
    setPage(1)
    setCandidateOnly(nextValue)
  }

  const openCreateRunModal = (row) => {
    setCreateRunRow(row)
    setCreateRunSymbol(row.symbol || '')
    setCreateRunTimeframe(row.timeframe || '')
    setCreateRunNote('')
  }

  const submitCreateRun = () => {
    if (!createRunRow) return
    createForwardRunMutation.mutate({
      strategyId: createRunRow.id,
      symbol: createRunSymbol,
      timeframe: createRunTimeframe,
      note: createRunNote,
    })
  }

  const toggleCompareJob = (jobId) => {
    setCompareSelectedJobIds((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId)
      }
      if (prev.length >= 2) {
        return prev
      }
      return [...prev, jobId]
    })
  }

  const clearCompareSelection = () => setCompareSelectedJobIds([])

  const openCompareModal = () => {
    if (compareSelectedJobIds.length !== 2) return
    setCompareModalJobs({
      leftJobId: compareSelectedJobIds[0],
      rightJobId: compareSelectedJobIds[1],
    })
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{t('backtests.title')}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {language === 'zh'
              ? '用于结构化回测结果导入，快速判断策略是否值得继续推进。'
              : 'Use this page to import structured backtest results and decide whether a strategy is worth progressing.'}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">{t('common.refreshing')}</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all })
            }
            className="px-3 sm:px-4"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingState label={t('backtests.loading')} /> : null}
      {error ? <ErrorState message={t('backtests.error')} /> : null}
      {!isLoading && !error ? (
        <ActiveDatasetStrip dataset={activeDataset} justImported={!!importResult} language={language} t={t} />
      ) : null}
      {!isLoading && !error && data && data.rows.length > 0 ? (
        <TableShell
          title={t('backtests.resultsTitle')}
          subtitle={t('backtests.resultsSubtitle', { page, total: data.total })}
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('backtests.candidateFilterLabel')}</p>
              <p className="text-xs text-slate-400">
                {candidateOnly ? t('backtests.candidateFilterOnlyHint') : t('backtests.candidateFilterAllHint')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCandidateFilterChange(false)}
                className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                  !candidateOnly
                    ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                    : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                }`}
              >
                {t('backtests.candidateFilterAll')}
              </button>
              <button
                type="button"
                onClick={() => handleCandidateFilterChange(true)}
                className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                  candidateOnly
                    ? 'border-amber-700/60 bg-amber-950/30 text-amber-200'
                    : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                }`}
              >
                {t('backtests.candidateFilterOnly')}
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500 sm:hidden">{t('common.swipeForMore')}</p>
          <div className="overflow-x-auto pb-1">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">{t('backtests.strategy')}</th>
                  <th className="pb-3 pr-4">{t('backtests.symbolTf')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.returnPct')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.winRate')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.maxDd')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.pf')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.tradeCount')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.finalScore')}</th>
                  <th className="pb-3 pr-4">{t('backtests.scoreBreakdown')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.decision')}</th>
                  <th className="pb-3 pr-4 text-right">{t('backtests.candidateActionHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="text-slate-300 transition-colors hover:bg-slate-800/30">
                      <td className="py-3 pr-4 font-medium text-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.name}</span>
                          {row.isCandidate ? (
                            <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200">
                              {t('backtests.candidateBadge')}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {row.symbol} · {row.timeframe}
                      </td>
                      <td className="py-3 pr-4 text-right">{row.returnPct.toFixed(2)}%</td>
                      <td className="py-3 pr-4 text-right">{row.winRate.toFixed(1)}%</td>
                      <td className={`py-3 pr-4 text-right ${row.maxDrawdown > 10 ? 'text-rose-400' : ''}`}>
                        {row.maxDrawdown.toFixed(2)}%
                      </td>
                      <td className="py-3 pr-4 text-right">{row.profitFactor.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right">{row.tradeCount}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-cyan-300">{row.finalScore}</td>
                      <td className="py-3 pr-4">
                        <ScoreBreakdownCard
                          compact
                          finalScore={row.finalScore}
                          breakdown={row.scoreBreakdown}
                          labels={breakdownLabels}
                        />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <DecisionBadge decision={row.decision} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {row.isCandidate ? (
                            <button
                              type="button"
                              onClick={() => openCreateRunModal(row)}
                              disabled={createForwardRunMutation.isPending}
                              className="rounded-md border border-cyan-700/50 bg-cyan-950/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-950/40 disabled:opacity-50"
                            >
                              {createForwardRunMutation.isPending && forwardRunActionStrategyId === row.id
                                ? t('backtests.forwardRunCreating')
                                : t('backtests.createForwardRun')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setLifecycleRow(row)}
                            className="rounded-md border border-indigo-700/40 bg-indigo-950/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-indigo-200 transition hover:bg-indigo-950/40"
                          >
                            {t('backtests.viewLifecycle')}
                          </button>
                          <button
                            type="button"
                            onClick={() => candidateMutation.mutate({ strategyId: row.id, nextIsCandidate: !row.isCandidate })}
                            disabled={candidateMutation.isPending}
                            className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition disabled:opacity-50 ${
                              row.isCandidate
                                ? 'border-rose-700/40 bg-rose-950/20 text-rose-200 hover:bg-rose-950/40'
                                : 'border-amber-700/40 bg-amber-950/20 text-amber-200 hover:bg-amber-950/40'
                            }`}
                          >
                            {candidateMutation.isPending && candidateActionStrategyId === row.id
                              ? t('backtests.candidateActionPending')
                              : row.isCandidate
                                ? t('backtests.candidateUnmark')
                                : t('backtests.candidateMark')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-slate-900/30">
                      <td colSpan={11} className="pb-3 pl-1 pr-1 sm:pl-2 sm:pr-2">
                        <BacktestEvaluationDetails row={row} breakdownLabels={breakdownLabels} />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </TableShell>
      ) : null}

      {!isLoading && !error && data && data.rows.length === 0 ? (
        <EmptyState
          title={candidateOnly ? t('backtests.candidateEmptyTitle') : t('backtests.emptyTitle')}
          description={candidateOnly ? t('backtests.candidateEmptyDesc') : t('backtests.emptyDesc')}
        />
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('backtests.importTitle')}</p>
            <p className="text-xs text-slate-400">{t('backtests.importSubtitle')}</p>
          </div>
        {importMutation.isPending || uploadMutation.isPending ? (
            <span className="text-xs text-cyan-300">{t('backtests.importing')}</span>
          ) : null}
        </div>

        <div className="mb-3 rounded-lg border border-sky-800/50 bg-sky-950/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-sky-200">{t('backtests.importNoticeTitle')}</p>
          <p className="mt-1 text-xs text-slate-300">{t('backtests.importNoticeIntro')}</p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
            <li>{t('backtests.importNoticeDesktop')}</li>
            <li>{t('backtests.importNoticeMobile')}</li>
            <li>{t('backtests.importNoticeStructured')}</li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">{t('backtests.importNoticeFuture')}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              {t('backtests.sourceTitle')}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t('backtests.sourceSubtitle')}</p>
            <select
              value={importSource}
              onChange={handleImportSourceChange}
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
            >
              {IMPORT_SOURCE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {selectedSource?.key === 'custom'
                ? t('backtests.sourceCustomHint')
                : t('backtests.sourceAutoFillHint')}
            </p>
          </div>

          <div className="rounded-lg border border-amber-800/50 bg-amber-950/15 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">
              {t('backtests.importRiskTitle')}
            </p>
            <p className="mt-1 text-xs text-amber-100/80">{t('backtests.importRiskSubtitle')}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <RiskPill label={t('backtests.riskPath')} value={importPath || '--'} breakAll />
              <RiskPill label={t('backtests.riskMode')} value={IMPORT_MODE} />
              <RiskPill label={t('backtests.riskOverwrite')} value={t('backtests.riskOverwriteYes')} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={importPath}
            onChange={handleImportPathChange}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
            placeholder={DEFAULT_IMPORT_PATH}
          />
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || !importPath.trim()}
            className="sm:min-w-[150px]"
          >
            {t('backtests.importAction')}
          </Button>
        </div>

        {/* Upload divider */}
        <div className="relative my-1 flex items-center">
          <div className="flex-1 border-t border-slate-800" />
          <span className="mx-3 text-xs text-slate-500">{t('backtests.uploadOrDivider')}</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        {/* Upload section */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 transition hover:border-cyan-700/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="truncate text-sm text-slate-400">
              {uploadFile ? uploadFile.name : t('backtests.uploadChooseFile')}
            </span>
            <input
              key={uploadFileKey}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !uploadFile}
            className="sm:min-w-[150px]"
          >
            {uploadMutation.isPending ? t('backtests.uploading') : t('backtests.uploadAction')}
          </Button>
        </div>

        {importError ? (
          <p className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {importError}
          </p>
        ) : null}

        {importResult ? (
          <div className="mt-4 rounded-lg border border-cyan-800/40 bg-cyan-950/10 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-100">{t('backtests.importResultsTitle')}</p>
                <p className="text-xs text-cyan-100/75">{importSummary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-700/50 bg-cyan-950/30 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">
                  {t('backtests.importResultsReplaceBadge')}
                </span>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                  {t('backtests.nowViewingLatest')}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-6">
              <ImportMetric label={t('backtests.importedCount')} value={importResult.importedCount} tone="cyan" />
              <ImportMetric label={t('backtests.skippedCount')} value={importResult.skippedCount} />
              <ImportMetric label={t('backtests.failedCount')} value={importResult.failedCount} tone="rose" />
              <ImportMetric label={t('backtests.invalidRowCount')} value={importResult.invalidRowCount} tone="amber" />
              <ImportMetric label={t('backtests.reEvaluatedCount')} value={importResult.reEvaluatedCount} />
              <ImportMetric label={t('backtests.snapshotWrittenCount')} value={importResult.snapshotWrittenCount} />
            </div>
          </div>
        ) : null}

        {importResult && Array.isArray(importResult.validationErrors) && importResult.validationErrors.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-amber-200">{t('backtests.validationErrorsTitle')}</p>
              <span className="rounded-full border border-amber-700/40 px-2 py-0.5 text-[11px] text-amber-200">
                {t('backtests.validationErrorsCount', { count: importResult.validationErrors.length })}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {importResult.validationErrors.slice(0, 5).map((message, index) => (
                <li key={`${message}-${index}`} className="break-all">
                  {message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
                  {importResult?.changesSummary ? (
                    <WhatChangedSection
                      summary={importResult.changesSummary}
                      jobId={importResult.jobId ?? null}
                      onViewDetails={setChangesJobId}
                      t={t}
                    />
                  ) : null}

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              {t('backtests.recentJobsTitle')}
            </p>
            {isImportJobsLoading ? (
              <span className="text-xs text-slate-400">{t('backtests.recentJobsLoading')}</span>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('backtests.recentJobsSubtitle')}</p>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
            <p className="text-xs text-slate-400">
              {compareSelectedJobIds.length}/2
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCompareSelection}
                disabled={compareSelectedJobIds.length === 0}
                className="rounded-md border border-slate-700 bg-slate-800/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                {t('backtests.compareClear')}
              </button>
              <button
                type="button"
                onClick={openCompareModal}
                disabled={compareSelectedJobIds.length !== 2}
                className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-cyan-200 transition hover:bg-cyan-900/30 disabled:opacity-50"
              >
                {t('backtests.compareAction')}
              </button>
            </div>
          </div>
          {compareSelectedJobIds.length !== 2 ? (
            <p className="mb-3 text-xs text-slate-500">{t('backtests.compareNotEnoughSelections')}</p>
          ) : null}

          {importJobs.length === 0 ? (
            <p className="text-sm text-slate-400">{t('backtests.recentJobsEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {importJobs.map((job) => {
                const isLatest = importJobs[0]?.id === job.id
                const isActive = activeSourceJobId !== null
                  ? job.id === activeSourceJobId
                  : isLatest
                const isCompared = compareSelectedJobIds.includes(job.id)
                const compareSlotsFull = compareSelectedJobIds.length >= 2
                const statusOk = job.status === 'success'
                const statusClass = statusOk
                  ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
                  : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
                const cardClass = isActive
                  ? 'border-cyan-700/60 bg-slate-900 p-3 text-xs text-slate-300 shadow-lg shadow-cyan-950/20'
                  : 'border-slate-800/90 bg-slate-900/70 p-3 text-xs text-slate-300'

                return (
                  <div
                    key={job.id}
                    className={`rounded-lg border ${cardClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isLatest ? (
                          <span className="rounded-full border border-cyan-700/50 bg-cyan-950/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-200">
                            {t('backtests.jobLatest')}
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-200">
                            {t('backtests.activateCurrentBadge')}
                          </span>
                        ) : null}
                        <p className="text-slate-100">
                          <span className="text-slate-400">{t('backtests.jobTriggeredAt')}: </span>
                          {formatImportJobDate(job.triggeredAt, language)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 font-medium ${statusClass}`}>
                        {resolveImportJobStatusLabel(job.status, t)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-[1.4fr_1fr]">
                      <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          {t('backtests.jobSourcePath')}
                        </p>
                        <p className="mt-1 break-all text-slate-200">{job.sourcePath || '--'}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <JobFact label={t('backtests.jobMode')} value={job.mode || '--'} />
                        <JobFact label={t('backtests.jobInvalidRows')} value={job.invalidRowCount ?? 0} />
                        <JobFact label={t('backtests.jobCounts')} value={`${job.importedCount}/${job.failedCount}`} />
                        <JobFact label={t('backtests.jobSnapshots')} value={job.snapshotWrittenCount} />
                      </div>
                    </div>
                    {job.errorMessage ? (
                      <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-200">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          {t('backtests.jobError')}
                        </p>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-300">{job.errorMessage}</p>
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {statusOk ? (
                        <button
                          type="button"
                          onClick={() => toggleCompareJob(job.id)}
                          disabled={!isCompared && compareSlotsFull}
                          className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition disabled:opacity-50 ${
                            isCompared
                              ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/40'
                              : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                          }`}
                        >
                          {isCompared ? t('backtests.compareSelected') : t('backtests.compareSelect')}
                        </button>
                      ) : null}
                      {!isActive && statusOk ? (
                        <button
                          type="button"
                          onClick={() => setConfirmActivateJobId(job.id)}
                          disabled={activateMutation.isPending}
                          className="rounded-md border border-emerald-700/40 bg-emerald-950/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-emerald-300 transition hover:border-emerald-600/60 hover:bg-emerald-950/40 disabled:opacity-50"
                        >
                          {activateMutation.isPending && confirmActivateJobId === job.id
                            ? t('backtests.activating')
                            : t('backtests.activateBtn')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setChangesJobId(job.id)}
                        className="rounded-md border border-indigo-700/40 bg-indigo-950/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-indigo-300 transition hover:border-indigo-600/60 hover:bg-indigo-950/40"
                      >
                        {t('backtests.wcViewDetails')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
      {changesJobId !== null ? (
        <ChangeDetailsModal
          jobId={changesJobId}
          onClose={() => setChangesJobId(null)}
          t={t}
        />
      ) : null}
      {activateResult ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            activateResult.ok
              ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
              : 'border-rose-700/60 bg-rose-950/40 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <span>{activateResult.message}</span>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => setActivateResult(null)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
      {forwardRunResult ? (
        <div
          className={`fixed bottom-20 right-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            forwardRunResult.ok
              ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
              : 'border-rose-700/60 bg-rose-950/40 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <span>{forwardRunResult.message}</span>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => setForwardRunResult(null)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
      {createRunRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <h3 className="text-base font-semibold text-slate-100">{t('backtests.createForwardRun')}</h3>
            <p className="mt-1 text-xs text-slate-400">{createRunRow.name}</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('backtests.forwardRunFormSymbol')}</span>
                <input
                  value={createRunSymbol}
                  onChange={(e) => setCreateRunSymbol(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('backtests.forwardRunFormTimeframe')}</span>
                <input
                  value={createRunTimeframe}
                  onChange={(e) => setCreateRunTimeframe(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('backtests.forwardRunFormNote')}</span>
                <textarea
                  value={createRunNote}
                  onChange={(e) => setCreateRunNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateRunRow(null)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('backtests.activateConfirmNo')}
              </button>
              <button
                type="button"
                onClick={submitCreateRun}
                disabled={createForwardRunMutation.isPending || !createRunSymbol.trim() || !createRunTimeframe.trim()}
                className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-950/50 disabled:opacity-50"
              >
                {createForwardRunMutation.isPending ? t('backtests.forwardRunCreating') : t('backtests.createForwardRun')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {lifecycleRow ? (
        <StrategyLifecycleModal
          row={lifecycleRow}
          lifecycle={lifecycleData}
          timelineItems={strategyTimelineData?.items || []}
          isTimelineLoading={isStrategyTimelineLoading}
          isLoading={isLifecycleLoading}
          error={lifecycleError}
          onClose={() => setLifecycleRow(null)}
          t={t}
          language={language}
          breakdownLabels={breakdownLabels}
        />
      ) : null}
      {compareModalJobs ? (
        <ImportJobsCompareModal
          leftJobId={compareModalJobs.leftJobId}
          rightJobId={compareModalJobs.rightJobId}
          onClose={() => setCompareModalJobs(null)}
          onActivateRight={async (rightJobId) => {
            try {
              await activateMutation.mutateAsync(rightJobId)
              return { ok: true }
            } catch (activationError) {
              return {
                ok: false,
                message: getApiErrorMessage(activationError, t('backtests.activateError')),
              }
            }
          }}
          activeSourceJobId={activeSourceJobId}
          t={t}
          language={language}
        />
      ) : null}
      {confirmActivateJobId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <h3 className="text-base font-semibold text-slate-100">{t('backtests.activateConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-slate-300">{t('backtests.activateConfirmMessage')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmActivateJobId(null)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('backtests.activateConfirmNo')}
              </button>
              <button
                type="button"
                onClick={() => activateMutation.mutate(confirmActivateJobId)}
                className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-950/50"
              >
                {activateMutation.isPending ? t('backtests.activating') : t('backtests.activateConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ActiveDatasetStrip({ dataset, justImported, language, t }) {
  if (!dataset) {
    return (
      <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">
        {t('backtests.activeDatasetNone')}
      </div>
    )
  }

  const timeStr = dataset.triggeredAt
    ? new Date(dataset.triggeredAt).toLocaleString(
        language === 'zh' ? 'zh-CN' : 'en-US',
        { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
      )
    : '--'

  const borderClass = justImported
    ? 'border-emerald-700/50 bg-emerald-950/10'
    : 'border-slate-700/60 bg-slate-950/50'

  return (
    <div className={`mb-4 rounded-lg border px-3 py-2.5 ${borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          {t('backtests.activeDatasetTitle')}
        </p>
        {justImported ? (
          <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            {t('backtests.activeDatasetJustUpdated')}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-500">{t('backtests.activeDatasetSource')}</p>
          <p className="mt-0.5 truncate font-medium text-slate-200" title={dataset.sourcePath}>
            {dataset.sourcePath || '--'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">{t('backtests.activeDatasetMode')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{dataset.mode || '--'}</p>
        </div>
        <div>
          <p className="text-slate-500">{t('backtests.activeDatasetTime')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{timeStr}</p>
        </div>
        <div>
          <p className="text-slate-500">{t('backtests.activeDatasetRows')}</p>
          <p className="mt-0.5 font-medium text-slate-200">{dataset.importedCount ?? '--'}</p>
        </div>
      </div>
    </div>
  )
}

function WhatChangedSection({ summary, jobId, onViewDetails, t }) {
  const hasChanges =
    summary.newStrategiesCount > 0 ||
    summary.removedStrategiesCount > 0 ||
    summary.changedStrategiesCount > 0 ||
    summary.decisionChangedCount > 0

  return (
    <div className="mt-3 rounded-lg border border-indigo-800/50 bg-indigo-950/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-200">{t('backtests.whatChangedTitle')}</p>
        <div className="flex items-center gap-2">
          {!hasChanges ? (
            <span className="text-xs text-slate-500">{t('backtests.whatChangedNoChange')}</span>
          ) : null}
          {jobId ? (
            <button
              type="button"
              onClick={() => onViewDetails(jobId)}
              className="rounded-md border border-indigo-700/40 bg-indigo-950/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-indigo-300 transition hover:border-indigo-600/60 hover:bg-indigo-950/40"
            >
              {t('backtests.wcViewDetails')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <WCMetric label={t('backtests.wcBefore')} value={summary.totalStrategiesBefore} />
        <WCMetric label={t('backtests.wcAfter')} value={summary.totalStrategiesAfter} />
        <WCMetric label={t('backtests.wcNew')} value={summary.newStrategiesCount} tone="emerald" />
        <WCMetric label={t('backtests.wcRemoved')} value={summary.removedStrategiesCount} tone="rose" />
        <WCMetric label={t('backtests.wcChanged')} value={summary.changedStrategiesCount} tone="amber" />
        <WCMetric label={t('backtests.wcDecision')} value={summary.decisionChangedCount} tone="indigo" />
      </div>

      {(summary.biggestScoreIncrease || summary.biggestScoreDecrease) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.biggestScoreIncrease ? (
            <div className="rounded-md border border-emerald-800/40 bg-slate-950/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-400/80">{t('backtests.wcBiggestIncrease')}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-200" title={summary.biggestScoreIncrease.name}>
                {summary.biggestScoreIncrease.name}
              </p>
              <p className="text-xs text-emerald-300">+{summary.biggestScoreIncrease.delta}</p>
            </div>
          ) : null}
          {summary.biggestScoreDecrease ? (
            <div className="rounded-md border border-rose-800/40 bg-slate-950/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-rose-400/80">{t('backtests.wcBiggestDecrease')}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-200" title={summary.biggestScoreDecrease.name}>
                {summary.biggestScoreDecrease.name}
              </p>
              <p className="text-xs text-rose-300">{summary.biggestScoreDecrease.delta}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {Array.isArray(summary.decisionChanges) && summary.decisionChanges.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('backtests.wcDecisionChanges')}</p>
          <ul className="space-y-1">
            {summary.decisionChanges.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-300">
                <span className="font-medium text-slate-100 truncate max-w-[180px]" title={item.name}>{item.name}</span>
                <span className="text-slate-500">{item.oldDecision}</span>
                <span className="text-slate-500">→</span>
                <span className={item.newDecision === 'PASS' ? 'text-emerald-300' : item.newDecision === 'NEEDS_IMPROVEMENT' ? 'text-amber-300' : 'text-rose-300'}>
                  {item.newDecision}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function WCMetric({ label, value, tone = 'default' }) {
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'rose'
        ? 'text-rose-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : tone === 'indigo'
            ? 'text-indigo-300'
            : 'text-slate-100'
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function ImportMetric({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-800/40 bg-cyan-950/10 text-cyan-100'
      : tone === 'rose'
        ? 'border-rose-800/40 bg-rose-950/10 text-rose-100'
        : tone === 'amber'
          ? 'border-amber-800/40 bg-amber-950/10 text-amber-100'
          : 'border-slate-800 bg-slate-950/70 text-slate-100'

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function RiskPill({ label, value, breakAll = false }) {
  return (
    <div className="rounded-md border border-amber-800/40 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-amber-200/80">{label}</p>
      <p className={`mt-1 text-slate-100 ${breakAll ? 'break-all' : ''}`}>{value}</p>
    </div>
  )
}

function JobFact({ label, value }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}

function StrategyLifecycleModal({
  row,
  lifecycle,
  timelineItems,
  isTimelineLoading,
  isLoading,
  error,
  onClose,
  t,
  language,
  breakdownLabels,
}) {
  const backtest = lifecycle?.backtest
  const sourceJob = lifecycle?.sourceJob
  const latestRun = lifecycle?.latestForwardRun
  const latestSummary = lifecycle?.latestSummary
  const latestGateResult = lifecycle?.latestGateResult
  const [exportMessage, setExportMessage] = useState('')

  const handleExportLifecycle = () => {
    try {
      if (!lifecycle && (!timelineItems || timelineItems.length === 0)) {
        setExportMessage(t('export.nothingToExport'))
        return
      }

      const lines = [
        `# ${t('export.exportLifecycle')}`,
        '',
        `- ${t('export.generatedAt')}: ${formatGeneratedAt()}`,
        '',
        '## Strategy',
        `- ID: ${asText(row?.id)}`,
        `- Name: ${asText(row?.name)}`,
        `- Symbol: ${asText(row?.symbol)}`,
        `- Timeframe: ${asText(row?.timeframe)}`,
        '',
        '## Current Status',
        `- Candidate: ${lifecycle?.candidate?.isCandidate ? 'yes' : 'no'}`,
        `- Latest Run Status: ${asText(latestRun?.status)}`,
        `- Latest Gate Decision: ${asText(latestGateResult?.gateDecision)}`,
        '',
        '## Summary Metrics',
        `- Backtest Final Score: ${asText(backtest?.finalScore)}`,
        `- Backtest Decision: ${asText(backtest?.decision)}`,
        `- Forward Total Trades: ${asText(latestSummary?.totalTrades)}`,
        `- Forward Win Rate: ${toNumberText(latestSummary?.winRate, 1)}`,
        `- Forward PnL: ${toNumberText(latestSummary?.pnl, 2)}`,
        `- Forward Max Drawdown: ${toNumberText(latestSummary?.maxDrawdown, 2)}`,
        '',
        '## Latest Note / Action',
        `- Run Note: ${asText(latestRun?.note)}`,
        `- Gate Notes: ${asText(latestGateResult?.notes)}`,
        '',
        '## Timeline (Recent)',
        ...timelineLines(timelineItems, 10),
      ]

      downloadMarkdown(`strategy-lifecycle-${asText(row?.id, 'unknown')}`, `${lines.join('\n')}\n`)
      setExportMessage(t('export.exportReady'))
    } catch {
      setExportMessage(t('export.exportFailed'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/70 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{t('backtests.lifecycleTitle')}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">{row.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{row.id} · {row.symbol} · {row.timeframe}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportLifecycle}
              className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-900/30"
            >
              {t('export.exportLifecycle')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
            >
              {t('backtests.lifecycleClose')}
            </button>
          </div>
        </div>
        {exportMessage ? <p className="mt-3 text-xs text-emerald-300">{exportMessage}</p> : null}

        {isLoading ? <LoadingState label={t('backtests.lifecycleLoading')} /> : null}
        {error ? <ErrorState message={t('backtests.lifecycleError')} /> : null}

        {!isLoading && !error && lifecycle ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <LifecycleStatusCard
                title={t('backtests.lifecycleCandidateStatus')}
                value={lifecycle.candidate?.isCandidate ? t('evaluation.yes') : t('evaluation.no')}
                tone={lifecycle.candidate?.isCandidate ? 'warning' : 'default'}
              />
              <LifecycleStatusCard
                title={t('backtests.lifecycleLatestRunStatus')}
                value={latestRun?.status ?? t('backtests.lifecycleNoForwardRunShort')}
                tone={latestRun ? 'accent' : 'default'}
              />
              <LifecycleStatusCard
                title={t('backtests.lifecycleLatestGateStatus')}
                value={latestGateResult?.gateDecision ?? t('backtests.lifecycleNoGateShort')}
                tone={resolveGateTone(latestGateResult?.gateDecision)}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <LifecycleSection title={t('backtests.lifecycleBacktestsSection')} subtitle={t('backtests.lifecycleBacktestsSectionDesc')}>
                {backtest ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <DecisionBadge decision={backtest.decision} />
                      <Badge tone={backtest.isInActiveDataset ? 'accent' : 'default'}>
                        {backtest.isInActiveDataset ? t('backtests.lifecycleInActiveDataset') : t('backtests.lifecycleNotInActiveDataset')}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <JobFact label={t('backtests.symbolTf')} value={`${backtest.symbol} · ${backtest.timeframe}`} />
                      <JobFact label={t('backtests.finalScore')} value={backtest.finalScore} />
                      <JobFact label={t('backtests.score')} value={backtest.rawScore} />
                      <JobFact label={t('backtests.decision')} value={backtest.rawDecision} />
                      <JobFact label={t('backtests.returnPct')} value={`${backtest.returnPct.toFixed(2)}%`} />
                      <JobFact label={t('backtests.winRate')} value={`${backtest.winRate.toFixed(1)}%`} />
                      <JobFact label={t('backtests.maxDd')} value={`${backtest.maxDrawdown.toFixed(2)}%`} />
                      <JobFact label={t('backtests.tradeCount')} value={backtest.tradeCount} />
                    </div>
                    <EvaluationSummaryCard
                      compact
                      finalScore={backtest.finalScore}
                      scoreBreakdown={backtest.scoreBreakdown}
                      breakdownLabels={breakdownLabels}
                      decision={backtest.decision}
                      decisionReason={backtest.decisionReason}
                      recommendedAction={backtest.recommendedAction}
                      explanation={backtest.explanation}
                      hardFailTriggered={backtest.hardFailTriggered}
                      hardFailReasons={backtest.hardFailReasons}
                      strongestFactor={backtest.strongestFactor}
                      weakestFactor={backtest.weakestFactor}
                      confidenceLevel={backtest.confidenceLevel}
                      sampleAdequacy={backtest.sampleAdequacy}
                      dataSourceType={backtest.dataSourceType}
                      evaluatedAt={backtest.evaluatedAt}
                      rulesVersion={backtest.rulesVersion}
                      datasetVersion={backtest.datasetVersion}
                      previousScore={backtest.previousScore}
                      scoreDelta={backtest.scoreDelta}
                      previousDecision={backtest.previousDecision}
                      decisionChanged={backtest.decisionChanged}
                    />
                  </div>
                ) : (
                  <LifecycleEmpty label={t('backtests.lifecycleBacktestsEmpty')} />
                )}
              </LifecycleSection>

              <LifecycleSection title={t('backtests.lifecycleCandidateSection')} subtitle={t('backtests.lifecycleCandidateSectionDesc')}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={lifecycle.candidate?.isCandidate ? 'warning' : 'default'}>
                      {lifecycle.candidate?.isCandidate ? t('backtests.candidateBadge') : t('backtests.lifecycleNotCandidate')}
                    </Badge>
                  </div>
                  <JobFact
                    label={t('backtests.lifecycleCandidateStatus')}
                    value={lifecycle.candidate?.isCandidate ? t('backtests.lifecycleCandidateMarked') : t('backtests.lifecycleCandidateNotMarked')}
                  />
                </div>
              </LifecycleSection>

              <LifecycleSection title={t('backtests.lifecycleRunSection')} subtitle={t('backtests.lifecycleRunSectionDesc')}>
                {latestRun ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <JobFact label={t('backtests.lifecycleRunId')} value={latestRun.id} />
                    <JobFact label={t('backtests.lifecycleRunStatusLabel')} value={latestRun.status} />
                    <JobFact label={t('backtests.symbolTf')} value={`${latestRun.symbol} · ${latestRun.timeframe}`} />
                    <JobFact label={t('backtests.lifecycleSourceJobId')} value={latestRun.sourceJobId ?? '--'} />
                    <JobFact label={t('backtests.lifecycleStartedAt')} value={formatImportJobDate(latestRun.startedAt, language)} />
                    <JobFact label={t('backtests.lifecycleEndedAt')} value={latestRun.endedAt ? formatImportJobDate(latestRun.endedAt, language) : '--'} />
                    <div className="sm:col-span-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('backtests.forwardRunFormNote')}</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">{latestRun.note || '--'}</p>
                    </div>
                  </div>
                ) : (
                  <LifecycleEmpty label={t('backtests.lifecycleRunEmpty')} />
                )}
              </LifecycleSection>

              <LifecycleSection title={t('backtests.lifecycleSummarySection')} subtitle={t('backtests.lifecycleSummarySectionDesc')}>
                {latestSummary ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <JobFact label={t('forwardGate.totalTrades')} value={latestSummary.totalTrades} />
                    <JobFact label={t('backtests.winRate')} value={`${latestSummary.winRate.toFixed(1)}%`} />
                    <JobFact label={t('forwardGate.pnl')} value={latestSummary.pnl.toFixed(2)} />
                    <JobFact label={t('backtests.maxDd')} value={`${latestSummary.maxDrawdown.toFixed(2)}%`} />
                    <JobFact label={t('forwardGate.expectancy')} value={latestSummary.expectancy.toFixed(2)} />
                    <JobFact label={t('forwardGate.coveredPeriod')} value={formatLifecyclePeriod(latestSummary.periodStart, latestSummary.periodEnd)} />
                  </div>
                ) : (
                  <LifecycleEmpty label={t('backtests.lifecycleSummaryEmpty')} />
                )}
              </LifecycleSection>

              <LifecycleSection title={t('backtests.lifecycleGateSection')} subtitle={t('backtests.lifecycleGateSectionDesc')}>
                {latestGateResult ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={resolveGateTone(latestGateResult.gateDecision)}>{latestGateResult.gateDecision}</Badge>
                      {latestGateResult.hardFail ? <Badge tone="danger">{t('forwardGate.hardFail')}</Badge> : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <JobFact label={t('forwardGate.confidence')} value={latestGateResult.confidence || '--'} />
                      <JobFact label={t('forwardGate.sampleAdequacy')} value={latestGateResult.sampleAdequacy || '--'} />
                      <JobFact label={t('forwardGate.strongestFactor')} value={latestGateResult.strongestFactor || '--'} />
                      <JobFact label={t('forwardGate.weakestFactor')} value={latestGateResult.weakestFactor || '--'} />
                      <JobFact label={t('forwardGate.evaluatedAt')} value={formatImportJobDate(latestGateResult.evaluatedAt, language)} />
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('forwardGate.notes')}</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">{latestGateResult.notes || '--'}</p>
                    </div>
                  </div>
                ) : (
                  <LifecycleEmpty label={t('backtests.lifecycleGateEmpty')} />
                )}
              </LifecycleSection>

              <LifecycleSection title={t('backtests.lifecycleSourceSection')} subtitle={t('backtests.lifecycleSourceSectionDesc')}>
                {sourceJob ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <JobFact label={t('backtests.lifecycleSourceJobId')} value={lifecycle.sourceJobId} />
                    <JobFact label={t('backtests.lifecycleImportStatus')} value={resolveImportJobStatusLabel(sourceJob.status, t)} />
                    <JobFact label={t('backtests.jobSourcePath')} value={sourceJob.sourcePath || '--'} />
                    <JobFact label={t('backtests.jobMode')} value={sourceJob.mode || '--'} />
                    <JobFact label={t('backtests.jobTriggeredAt')} value={formatImportJobDate(sourceJob.triggeredAt, language)} />
                    <JobFact label={t('backtests.importedCount')} value={sourceJob.importedCount} />
                  </div>
                ) : (
                  <LifecycleEmpty label={t('backtests.lifecycleSourceEmpty')} />
                )}
              </LifecycleSection>

              <LifecycleSection title={t('timeline.activityTimeline')} subtitle={t('timeline.timeline')}>
                <ActivityTimeline
                  items={timelineItems}
                  isLoading={isTimelineLoading}
                  t={t}
                  language={language}
                />
              </LifecycleSection>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LifecycleSection({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function LifecycleStatusCard({ title, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-2">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  )
}

function LifecycleEmpty({ label }) {
  return <p className="text-sm text-slate-400">{label}</p>
}

function formatLifecyclePeriod(start, end) {
  if (!start && !end) return '--'
  return `${start || '--'} -> ${end || '--'}`
}

function resolveGateTone(decision) {
  if (decision === 'PASS') return 'success'
  if (decision === 'PROMISING' || decision === 'NEEDS_IMPROVEMENT') return 'warning'
  if (decision === 'FAIL' || decision === 'REJECT') return 'danger'
  return 'default'
}

function CompareSummaryCard({ label, value, tone = 'default' }) {
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'rose'
        ? 'text-rose-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : 'text-cyan-200'
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function ImportJobsCompareModal({ leftJobId, rightJobId, onClose, onActivateRight, activeSourceJobId, t, language }) {
  const [confirmActivate, setConfirmActivate] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activationErrorText, setActivationErrorText] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.importJobs.compare(leftJobId, rightJobId),
    queryFn: () => compareImportJobs(leftJobId, rightJobId),
    enabled: leftJobId != null && rightJobId != null,
  })

  const compareErrorText = (() => {
    if (!error) return ''
    const msg = getApiErrorMessage(error, t('backtests.compareError'))
    if (/snapshot/i.test(msg)) {
      return t('backtests.compareUnavailable')
    }
    return msg
  })()

  const handleActivateRight = async () => {
    setActivating(true)
    setActivationErrorText('')
    const result = await onActivateRight(rightJobId)
    setActivating(false)
    setConfirmActivate(false)
    if (!result?.ok) {
      setActivationErrorText(result?.message || t('backtests.activateError'))
      return
    }
  }

  const isLeftActive = activeSourceJobId != null && data?.leftJob?.jobId === activeSourceJobId
  const isRightActive = activeSourceJobId != null && data?.rightJob?.jobId === activeSourceJobId
  const canActivateRight = data && !isRightActive

  const renderDecisionRows = () => {
    if (!data) return null
    const keys = Array.from(
      new Set([
        ...Object.keys(data.decisionDistribution.left || {}),
        ...Object.keys(data.decisionDistribution.right || {}),
      ]),
    )
    return keys.map((key) => (
      <tr key={key} className="border-t border-slate-800/60 text-xs text-slate-300">
        <td className="py-1.5 pr-3 font-medium text-slate-100">{key}</td>
        <td className="py-1.5 pr-3 text-right">{data.decisionDistribution.left[key] ?? 0}</td>
        <td className="py-1.5 text-right">{data.decisionDistribution.right[key] ?? 0}</td>
      </tr>
    ))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-6xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">{t('backtests.compareTitle')}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {isLoading ? <p className="text-sm text-slate-400">{t('backtests.compareLoading')}</p> : null}
          {error ? <p className="text-sm text-rose-300">{compareErrorText || t('backtests.compareError')}</p> : null}
          {!isLoading && !error && !data ? <p className="text-sm text-slate-400">{t('backtests.compareEmpty')}</p> : null}
          {activationErrorText ? <p className="mb-2 text-sm text-rose-300">{activationErrorText}</p> : null}

          {!isLoading && !error && data ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                {canActivateRight ? (
                  <button
                    type="button"
                    onClick={() => setConfirmActivate(true)}
                    className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-medium uppercase tracking-[0.1em] text-emerald-200 transition hover:bg-emerald-900/30"
                  >
                    {t('backtests.compareActivateRight')}
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-lg border bg-slate-950/60 p-3 ${isLeftActive ? 'border-emerald-700/60' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-cyan-300">{t('backtests.compareLeft')}</p>
                    {isLeftActive ? (
                      <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-200">
                        {t('backtests.compareActiveBadge')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">#{data.leftJob.jobId}</p>
                  <p className="mt-1 break-all text-xs text-slate-400">{data.leftJob.source || '--'}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatImportJobDate(data.leftJob.createdAt, language)}</p>
                </div>
                <div className={`rounded-lg border bg-slate-950/60 p-3 ${isRightActive ? 'border-emerald-700/60' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-indigo-300">{t('backtests.compareRight')}</p>
                    {isRightActive ? (
                      <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-200">
                        {t('backtests.compareActiveBadge')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">#{data.rightJob.jobId}</p>
                  <p className="mt-1 break-all text-xs text-slate-400">{data.rightJob.source || '--'}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatImportJobDate(data.rightJob.createdAt, language)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-7">
                <CompareSummaryCard label={t('backtests.compareTotals')} value={`${data.totalStrategiesLeft} / ${data.totalStrategiesRight}`} />
                <CompareSummaryCard label={t('backtests.wcNew')} value={data.newStrategiesCount} tone="emerald" />
                <CompareSummaryCard label={t('backtests.wcRemoved')} value={data.removedStrategiesCount} tone="rose" />
                <CompareSummaryCard label={t('backtests.wcChanged')} value={data.changedStrategiesCount} tone="amber" />
                <CompareSummaryCard label={t('backtests.wcDecision')} value={data.decisionChangedCount} />
                <CompareSummaryCard label={t('backtests.compareUpgrades')} value={data.decisionUpgradeCount} tone="emerald" />
                <CompareSummaryCard label={t('backtests.compareDowngrades')} value={data.decisionDowngradeCount} tone="rose" />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr]">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {t('backtests.compareDecisionDistribution')}
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="text-left pb-1">{t('backtests.decision')}</th>
                        <th className="text-right pb-1">{t('backtests.compareLeft')}</th>
                        <th className="text-right pb-1">{t('backtests.compareRight')}</th>
                      </tr>
                    </thead>
                    <tbody>{renderDecisionRows()}</tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {t('backtests.compareTopChanged')}
                  </p>
                  <p className="mb-2 text-xs text-slate-500 sm:hidden">{t('common.swipeForMore')}</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-[820px] w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
                          <th className="pb-2 pr-3">{t('backtests.strategy')}</th>
                          <th className="pb-2 pr-3 text-right">{t('backtests.compareLeftScore')}</th>
                          <th className="pb-2 pr-3 text-right">{t('backtests.compareRightScore')}</th>
                          <th className="pb-2 pr-3 text-right">{t('backtests.wcColDelta')}</th>
                          <th className="pb-2 pr-3">{t('backtests.compareLeftDecision')}</th>
                          <th className="pb-2 pr-3">{t('backtests.compareRightDecision')}</th>
                          <th className="pb-2">{t('backtests.compareChangeType')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {data.topChangedStrategies.map((item) => (
                          <tr key={item.strategyId} className="text-slate-300">
                            <td className="py-2 pr-3 max-w-[170px] truncate text-slate-100" title={item.strategyName}>{item.strategyName}</td>
                            <td className="py-2 pr-3 text-right">{item.leftScore ?? '--'}</td>
                            <td className="py-2 pr-3 text-right">{item.rightScore ?? '--'}</td>
                            <td className={`py-2 pr-3 text-right ${item.delta == null ? 'text-slate-500' : item.delta > 0 ? 'text-emerald-300' : item.delta < 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                              {getDeltaDisplay(item.delta)}
                            </td>
                            <td className="py-2 pr-3">{item.leftDecision ?? '--'}</td>
                            <td className="py-2 pr-3">{item.rightDecision ?? '--'}</td>
                            <td className="py-2">{item.changeType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {confirmActivate ? (
          <div className="border-t border-slate-800 px-5 py-4">
            <h4 className="text-sm font-semibold text-slate-100">{t('backtests.compareActivateConfirmTitle')}</h4>
            <p className="mt-1 text-sm text-slate-300">{t('backtests.compareActivateConfirmMessage')}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmActivate(false)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('backtests.compareActivateConfirmNo')}
              </button>
              <button
                type="button"
                onClick={handleActivateRight}
                disabled={activating}
                className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-950/50 disabled:opacity-60"
              >
                {activating ? t('backtests.activating') : t('backtests.compareActivateConfirmYes')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const CHANGE_TYPE_FILTERS = ['ALL', 'NEW', 'REMOVED', 'UPDATED', 'DECISION_CHANGED']

function getFilterLabel(filter, t) {
  const map = {
    ALL: t('backtests.wcFilterAll'),
    NEW: t('backtests.wcFilterNew'),
    REMOVED: t('backtests.wcFilterRemoved'),
    UPDATED: t('backtests.wcFilterUpdated'),
    DECISION_CHANGED: t('backtests.wcFilterDecisionChanged'),
  }
  return map[filter] ?? filter
}

function getDeltaDisplay(delta) {
  if (delta === null || delta === undefined) return '--'
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '0'
}

function ChangeTypeTag({ type }) {
  const cls =
    type === 'NEW'
      ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300'
      : type === 'REMOVED'
        ? 'border-rose-700/50 bg-rose-950/30 text-rose-300'
        : 'border-amber-700/50 bg-amber-950/30 text-amber-300'
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${cls}`}>
      {type}
    </span>
  )
}

function DecisionCell({ value, highlight = false }) {
  if (!value) return <span className="text-slate-600">--</span>
  const decisionClass =
    value === 'PASS'
      ? highlight ? 'text-emerald-300 font-semibold' : 'text-emerald-400'
      : value === 'NEEDS_IMPROVEMENT'
        ? highlight ? 'text-amber-300 font-semibold' : 'text-amber-400'
        : highlight ? 'text-rose-300 font-semibold' : 'text-rose-400'
  return <span className={decisionClass}>{value}</span>
}

function ChangeDetailsModal({ jobId, onClose, t }) {
  const [activeFilter, setActiveFilter] = useState('ALL')

  const apiChangeType =
    activeFilter === 'ALL' || activeFilter === 'DECISION_CHANGED'
      ? undefined
      : activeFilter

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.importJobs.changes(jobId, apiChangeType),
    queryFn: () => getImportJobChanges(jobId, apiChangeType, 200, 0),
    enabled: jobId !== null,
  })

  const items = data?.items ?? []

  const filteredItems =
    activeFilter === 'DECISION_CHANGED'
      ? items.filter((item) => item.beforeDecision !== item.afterDecision)
      : items

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('backtests.wcDetailsTitle')}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Job #{jobId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-slate-800">
          {CHANGE_TYPE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                activeFilter === filter
                  ? 'border-indigo-600/70 bg-indigo-950/50 text-indigo-200'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {getFilterLabel(filter, t)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {isLoading ? (
            <p className="text-sm text-slate-400">{t('backtests.wcDetailsLoading')}</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{t('backtests.wcDetailsError')}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-400">{t('backtests.wcDetailsEmpty')}</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">{filteredItems.length} / {data?.total ?? 0}</p>
              <p className="mb-3 text-xs text-slate-500 sm:hidden">{t('common.swipeForMore')}</p>
              <div className="overflow-x-auto pb-1">
                <table className="min-w-[700px] w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">{t('backtests.wcColStrategy')}</th>
                      <th className="pb-2 pr-4">{t('backtests.wcColType')}</th>
                      <th className="pb-2 pr-4 text-right">{t('backtests.wcColBeforeScore')}</th>
                      <th className="pb-2 pr-4 text-right">{t('backtests.wcColAfterScore')}</th>
                      <th className="pb-2 pr-4 text-right">{t('backtests.wcColDelta')}</th>
                      <th className="pb-2 pr-4">{t('backtests.wcColBeforeDecision')}</th>
                      <th className="pb-2">{t('backtests.wcColAfterDecision')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map((item) => {
                      const decisionChanged = item.beforeDecision !== item.afterDecision
                      const rowCls = decisionChanged ? 'bg-indigo-950/10' : ''
                      const delta = item.scoreDelta
                      const deltaClass =
                        delta === null ? 'text-slate-500'
                        : delta > 0 ? 'text-emerald-300 font-semibold'
                        : delta < 0 ? 'text-rose-300 font-semibold'
                        : 'text-slate-400'
                      return (
                        <tr key={item.id} className={`text-slate-300 ${rowCls}`}>
                          <td className="py-2 pr-4 font-medium text-slate-100 max-w-[180px] truncate" title={item.strategyName}>
                            {item.strategyName}
                          </td>
                          <td className="py-2 pr-4">
                            <ChangeTypeTag type={item.changeType} />
                          </td>
                          <td className="py-2 pr-4 text-right text-slate-400">
                            {item.beforeScore ?? '--'}
                          </td>
                          <td className="py-2 pr-4 text-right text-slate-200">
                            {item.afterScore ?? '--'}
                          </td>
                          <td className={`py-2 pr-4 text-right ${deltaClass}`}>
                            {getDeltaDisplay(item.scoreDelta)}
                          </td>
                          <td className="py-2 pr-4">
                            <DecisionCell value={item.beforeDecision} />
                          </td>
                          <td className="py-2">
                            <DecisionCell value={item.afterDecision} highlight={decisionChanged} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BacktestEvaluationDetails({ row, breakdownLabels }) {
  const { data: historyItems = [] } = useQuery({
    queryKey: queryKeys.evaluations.history('backtests', row.id, 5),
    queryFn: () => getEvaluationHistory('backtests', row.id, 5),
  })

  return (
    <EvaluationSummaryCard
      compact
      finalScore={row.finalScore}
      scoreBreakdown={row.scoreBreakdown}
      decision={row.decision}
      decisionReason={row.decisionReason}
      recommendedAction={row.recommendedAction}
      explanation={row.explanation}
      breakdownLabels={breakdownLabels}
      hardFailTriggered={row.hardFailTriggered}
      hardFailReasons={row.hardFailReasons}
      strongestFactor={row.strongestFactor}
      weakestFactor={row.weakestFactor}
      confidenceLevel={row.confidenceLevel}
      sampleAdequacy={row.sampleAdequacy}
      dataSourceType={row.dataSourceType}
      evaluatedAt={row.evaluatedAt}
      rulesVersion={row.rulesVersion}
      datasetVersion={row.datasetVersion}
      previousScore={row.previousScore}
      scoreDelta={row.scoreDelta}
      previousDecision={row.previousDecision}
      decisionChanged={row.decisionChanged}
      historyItems={historyItems}
    />
  )
}

export default BacktestsPage
