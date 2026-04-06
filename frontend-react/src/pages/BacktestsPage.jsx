import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment } from 'react'
import { useState } from 'react'
import EvaluationSummaryCard from '../components/evaluation/EvaluationSummaryCard'
import DecisionBadge from '../components/evaluation/DecisionBadge'
import ScoreBreakdownCard from '../components/evaluation/ScoreBreakdownCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import TableShell from '../components/ui/TableShell'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import {
  getBacktestsData,
  getRecentImportJobs,
  importBacktestsCsv,
} from '../services/api/backtests'
import { getEvaluationHistory } from '../services/api/evaluationHistory'

const PAGE_SIZE = 10
const DEFAULT_IMPORT_PATH = 'backend/data_sources/backtests.csv'
const IMPORT_JOBS_LIMIT = 5

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

function BacktestsPage() {
  const { t, language } = useLanguage()
  const [page, setPage] = useState(1)
  const [importPath, setImportPath] = useState(DEFAULT_IMPORT_PATH)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const queryClient = useQueryClient()

  const breakdownLabels = {
    returnPct: t('backtests.returnPct'),
    maxDrawdown: t('backtests.maxDd'),
    profitFactor: t('backtests.pf'),
    winRate: t('backtests.winRate'),
    tradeCount: t('backtests.tradeCount'),
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.backtests.list(page, PAGE_SIZE),
    queryFn: () => getBacktestsData(page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  })

  const { data: importJobs = [], isLoading: isImportJobsLoading } = useQuery({
    queryKey: queryKeys.importJobs.recent(IMPORT_JOBS_LIMIT),
    queryFn: () => getRecentImportJobs(IMPORT_JOBS_LIMIT),
  })

  const importMutation = useMutation({
    mutationFn: () => importBacktestsCsv(importPath, 'replace'),
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

  if (isLoading) {
    return <LoadingState label={t('backtests.loading')} />
  }

  if (error) {
    return <ErrorState message={t('backtests.error')} />
  }

  if (!data || data.rows.length === 0) {
    return <EmptyState title={t('backtests.emptyTitle')} description={t('backtests.emptyDesc')} />
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{t('backtests.title')}</p>
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

      <TableShell
        title={t('backtests.resultsTitle')}
        subtitle={t('backtests.resultsSubtitle', { page, total: data.total })}
        page={page}
        pageSize={PAGE_SIZE}
        total={data.total}
        onPageChange={setPage}
      >
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="text-slate-300 transition-colors hover:bg-slate-800/30">
                    <td className="py-3 pr-4 font-medium text-slate-100">{row.name}</td>
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
                  </tr>
                  <tr className="bg-slate-900/30">
                    <td colSpan={10} className="pb-3 pl-1 pr-1 sm:pl-2 sm:pr-2">
                      <BacktestEvaluationDetails row={row} breakdownLabels={breakdownLabels} />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">{t('backtests.importTitle')}</p>
            <p className="text-xs text-slate-400">{t('backtests.importSubtitle')}</p>
          </div>
          {importMutation.isPending ? (
            <span className="text-xs text-cyan-300">{t('backtests.importing')}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={importPath}
            onChange={(event) => setImportPath(event.target.value)}
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

        {importError ? (
          <p className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {importError}
          </p>
        ) : null}

        {importResult ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-6">
            <ImportMetric label={t('backtests.importedCount')} value={importResult.importedCount} />
            <ImportMetric label={t('backtests.skippedCount')} value={importResult.skippedCount} />
            <ImportMetric label={t('backtests.failedCount')} value={importResult.failedCount} />
            <ImportMetric label={t('backtests.invalidRowCount')} value={importResult.invalidRowCount} />
            <ImportMetric label={t('backtests.reEvaluatedCount')} value={importResult.reEvaluatedCount} />
            <ImportMetric label={t('backtests.snapshotWrittenCount')} value={importResult.snapshotWrittenCount} />
          </div>
        ) : null}

        {importResult && Array.isArray(importResult.validationErrors) && importResult.validationErrors.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
            <p className="font-semibold text-amber-200">{t('backtests.validationErrorsTitle')}</p>
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
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              {t('backtests.recentJobsTitle')}
            </p>
            {isImportJobsLoading ? (
              <span className="text-xs text-slate-400">{t('backtests.recentJobsLoading')}</span>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('backtests.recentJobsSubtitle')}</p>

          {importJobs.length === 0 ? (
            <p className="text-sm text-slate-400">{t('backtests.recentJobsEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {importJobs.map((job) => {
                const statusOk = job.status === 'success'
                const statusClass = statusOk
                  ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
                  : 'border-rose-700/60 bg-rose-950/30 text-rose-200'

                return (
                  <div
                    key={job.id}
                    className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 text-xs text-slate-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-slate-100">
                        <span className="text-slate-400">{t('backtests.jobTriggeredAt')}: </span>
                        {formatImportJobDate(job.triggeredAt, language)}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 font-medium ${statusClass}`}>
                        {resolveImportJobStatusLabel(job.status, t)}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-slate-300">
                      <span className="text-slate-400">{t('backtests.jobSourcePath')}: </span>
                      {job.sourcePath || '--'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <p>
                        <span className="text-slate-400">{t('backtests.jobMode')}: </span>
                        {job.mode || '--'}
                      </p>
                      <p>
                        <span className="text-slate-400">{t('backtests.jobCounts')}: </span>
                        {job.importedCount}/{job.failedCount}
                      </p>
                      <p>
                        <span className="text-slate-400">{t('backtests.jobInvalidRows')}: </span>
                        {job.invalidRowCount ?? 0}
                      </p>
                      <p>
                        <span className="text-slate-400">{t('backtests.jobSnapshots')}: </span>
                        {job.snapshotWrittenCount}
                      </p>
                    </div>
                    {job.errorMessage ? (
                      <p className="mt-2 rounded border border-rose-800/50 bg-rose-950/20 px-2 py-1 text-rose-200">
                        <span className="text-rose-300">{t('backtests.jobError')}: </span>
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ImportMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
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
