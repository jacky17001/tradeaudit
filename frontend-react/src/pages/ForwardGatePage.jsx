import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import TableShell from '../components/ui/TableShell'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import {
  getForwardRunGateResult,
  getGateResults,
  getForwardRunSummary,
  getForwardRuns,
  saveForwardRunGateResult,
  saveForwardRunSummary,
  updateForwardRunStatus,
} from '../services/api/forwardRuns'

const FORWARD_PAGE_SIZE = 10
const GATE_PAGE_SIZE = 10
const STATUS_FILTERS = ['ALL', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED']
const GATE_DECISION_FILTERS = ['ALL', 'PASS', 'PROMISING', 'NEEDS_IMPROVEMENT', 'FAIL', 'REJECT']

function formatDate(value, language) {
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

function statusLabel(status, t) {
  if (status === 'RUNNING') return t('forwardGate.statusRunning')
  if (status === 'PAUSED') return t('forwardGate.statusPaused')
  if (status === 'COMPLETED') return t('forwardGate.statusCompleted')
  if (status === 'FAILED') return t('forwardGate.statusFailed')
  return status
}

function statusClass(status) {
  if (status === 'RUNNING') return 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
  if (status === 'PAUSED') return 'border-amber-700/50 bg-amber-950/30 text-amber-200'
  if (status === 'COMPLETED') return 'border-cyan-700/50 bg-cyan-950/30 text-cyan-200'
  if (status === 'FAILED') return 'border-rose-700/50 bg-rose-950/30 text-rose-200'
  return 'border-slate-700/50 bg-slate-900/30 text-slate-300'
}

function nextActions(status) {
  if (status === 'RUNNING') return ['PAUSED', 'COMPLETED', 'FAILED']
  if (status === 'PAUSED') return ['RUNNING', 'COMPLETED', 'FAILED']
  return []
}

function actionLabel(status, t) {
  if (status === 'RUNNING') return t('forwardGate.actionResume')
  if (status === 'PAUSED') return t('forwardGate.actionPause')
  if (status === 'COMPLETED') return t('forwardGate.actionComplete')
  if (status === 'FAILED') return t('forwardGate.actionFail')
  return status
}

function formatPeriod(start, end) {
  if (!start && !end) return '--'
  if (start && end) return `${start} ~ ${end}`
  return start || end || '--'
}

function gateDecisionClass(decision) {
  if (decision === 'PASS') return 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
  if (decision === 'PROMISING') return 'border-cyan-700/50 bg-cyan-950/30 text-cyan-200'
  if (decision === 'NEEDS_IMPROVEMENT') return 'border-amber-700/50 bg-amber-950/30 text-amber-200'
  if (decision === 'FAIL') return 'border-rose-700/50 bg-rose-950/30 text-rose-200'
  if (decision === 'REJECT') return 'border-red-700/60 bg-red-950/30 text-red-200'
  return 'border-slate-700/50 bg-slate-900/30 text-slate-300'
}

function ForwardGatePage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [gatePage, setGatePage] = useState(1)
  const [gateDecisionFilter, setGateDecisionFilter] = useState('ALL')
  const [statusResult, setStatusResult] = useState(null)
  const [statusUpdatingRunId, setStatusUpdatingRunId] = useState(null)
  const [summaryModal, setSummaryModal] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [gateModal, setGateModal] = useState(null)
  const [gateLoading, setGateLoading] = useState(false)
  const [summaryForm, setSummaryForm] = useState({
    totalTrades: '',
    winRate: '',
    pnl: '',
    maxDrawdown: '',
    expectancy: '',
    periodStart: '',
    periodEnd: '',
  })
  const [gateForm, setGateForm] = useState({
    gateDecision: 'PASS',
    confidence: '',
    hardFail: false,
    sampleAdequacy: '',
    strongestFactor: '',
    weakestFactor: '',
    notes: '',
  })

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.forwardRuns.list(statusFilter, page, FORWARD_PAGE_SIZE),
    queryFn: () => getForwardRuns(statusFilter, page, FORWARD_PAGE_SIZE),
    placeholderData: (prev) => prev,
  })

  const {
    data: gateListData,
    isLoading: gateListLoading,
    isFetching: gateListFetching,
    error: gateListError,
  } = useQuery({
    queryKey: queryKeys.gateResults.list(gateDecisionFilter, gatePage, GATE_PAGE_SIZE),
    queryFn: () => getGateResults(gateDecisionFilter, gatePage, GATE_PAGE_SIZE),
    placeholderData: (prev) => prev,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ runId, status }) => updateForwardRunStatus(runId, status),
    onMutate: ({ runId }) => {
      setStatusUpdatingRunId(runId)
    },
    onSuccess: async () => {
      setStatusResult({ ok: true, message: t('forwardGate.updateStatusSuccess') })
      await queryClient.invalidateQueries({ queryKey: queryKeys.forwardRuns.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.gateResults.all })
    },
    onError: () => {
      setStatusResult({ ok: false, message: t('forwardGate.updateStatusFailed') })
    },
    onSettled: () => {
      setStatusUpdatingRunId(null)
    },
  })

  const saveSummaryMutation = useMutation({
    mutationFn: ({ runId, payload }) => saveForwardRunSummary(runId, payload),
    onSuccess: async () => {
      setStatusResult({ ok: true, message: t('forwardGate.summarySaved') })
      setSummaryModal(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.forwardRuns.all })
    },
    onError: () => {
      setStatusResult({ ok: false, message: t('forwardGate.summaryFailed') })
    },
  })

  const saveGateMutation = useMutation({
    mutationFn: ({ runId, payload }) => saveForwardRunGateResult(runId, payload),
    onSuccess: async () => {
      setStatusResult({ ok: true, message: t('forwardGate.gateResultSaved') })
      setGateModal(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.forwardRuns.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.gateResults.all })
    },
    onError: () => {
      setStatusResult({ ok: false, message: t('forwardGate.gateResultFailed') })
    },
  })

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const gateRows = gateListData?.items ?? []
  const gateTotal = gateListData?.total ?? 0

  const onChangeFilter = (nextFilter) => {
    setStatusFilter(nextFilter)
    setPage(1)
  }

  const onChangeGateFilter = (nextFilter) => {
    setGateDecisionFilter(nextFilter)
    setGatePage(1)
  }

  const openSummaryModal = async (run, mode) => {
    setSummaryModal({ run, mode })
    setSummaryLoading(true)

    const existing = run.summary ?? (await getForwardRunSummary(run.id))
    setSummaryForm({
      totalTrades: existing?.totalTrades != null ? String(existing.totalTrades) : '',
      winRate: existing?.winRate != null ? String(existing.winRate) : '',
      pnl: existing?.pnl != null ? String(existing.pnl) : '',
      maxDrawdown: existing?.maxDrawdown != null ? String(existing.maxDrawdown) : '',
      expectancy: existing?.expectancy != null ? String(existing.expectancy) : '',
      periodStart: existing?.periodStart || '',
      periodEnd: existing?.periodEnd || '',
    })
    setSummaryLoading(false)
  }

  const submitSummary = () => {
    if (!summaryModal) return
    saveSummaryMutation.mutate({
      runId: summaryModal.run.id,
      payload: {
        totalTrades: Number(summaryForm.totalTrades || 0),
        winRate: Number(summaryForm.winRate || 0),
        pnl: Number(summaryForm.pnl || 0),
        maxDrawdown: Number(summaryForm.maxDrawdown || 0),
        expectancy: Number(summaryForm.expectancy || 0),
        periodStart: summaryForm.periodStart || null,
        periodEnd: summaryForm.periodEnd || null,
      },
    })
  }

  const openGateModal = async (run, mode) => {
    setGateModal({ run, mode })
    setGateLoading(true)

    const existing = run.gateResult ?? (await getForwardRunGateResult(run.id))
    setGateForm({
      gateDecision: existing?.gateDecision || 'PASS',
      confidence: existing?.confidence || '',
      hardFail: !!existing?.hardFail,
      sampleAdequacy: existing?.sampleAdequacy || '',
      strongestFactor: existing?.strongestFactor || '',
      weakestFactor: existing?.weakestFactor || '',
      notes: existing?.notes || '',
    })
    setGateLoading(false)
  }

  const submitGateResult = () => {
    if (!gateModal) return
    saveGateMutation.mutate({
      runId: gateModal.run.id,
      payload: {
        gateDecision: gateForm.gateDecision,
        confidence: gateForm.confidence || null,
        hardFail: gateForm.hardFail,
        sampleAdequacy: gateForm.sampleAdequacy || null,
        strongestFactor: gateForm.strongestFactor || null,
        weakestFactor: gateForm.weakestFactor || null,
        notes: gateForm.notes || '',
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{t('forwardGate.title')}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {language === 'zh'
              ? '把前向结果转成是否继续、暂停或拒绝的清晰决策。'
              : 'Turn forward results into clear decisions: continue, pause, or reject.'}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">{t('common.refreshing')}</span>
          ) : null}
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.forwardRuns.all })}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {t('common.refresh')}
          </button>
          {gateListFetching ? (
            <span className="text-xs text-cyan-300">{t('common.refreshing')}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChangeFilter(status)}
            className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
              statusFilter === status
                ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
            }`}
          >
            {status === 'ALL' ? t('forwardGate.statusAll') : statusLabel(status, t)}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState label={t('forwardGate.loadingRuns')} /> : null}
      {error ? <ErrorState message={t('forwardGate.errorRuns')} /> : null}

      {!isLoading && !error && rows.length > 0 ? (
        <TableShell
          title={t('forwardGate.registryTitle')}
          subtitle={t('forwardGate.registrySubtitle', { page, total })}
          page={page}
          pageSize={FORWARD_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        >
          <p className="mb-3 text-xs text-slate-500 sm:hidden">{t('common.swipeForMore')}</p>
          <div className="overflow-x-auto pb-1">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">{t('forwardGate.colStrategy')}</th>
                  <th className="pb-3 pr-4">{t('forwardGate.colSourceJob')}</th>
                  <th className="pb-3 pr-4">{t('forwardGate.colSymbol')}</th>
                  <th className="pb-3 pr-4">{t('forwardGate.colTimeframe')}</th>
                  <th className="pb-3 pr-4">{t('forwardGate.colStatus')}</th>
                  <th className="pb-3 pr-4">{t('forwardGate.colStartedAt')}</th>
                  <th className="pb-3 pr-4 text-right">{t('forwardGate.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row) => {
                  const actions = nextActions(row.status)
                  return (
                    <Fragment key={row.id}>
                      <tr className="text-slate-300 transition-colors hover:bg-slate-800/30">
                        <td className="py-3 pr-4 font-medium text-slate-100">{row.strategyName}</td>
                        <td className="py-3 pr-4">{row.sourceJobId ?? '--'}</td>
                        <td className="py-3 pr-4">{row.symbol}</td>
                        <td className="py-3 pr-4">{row.timeframe}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(row.status)}`}>
                            {statusLabel(row.status, t)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{formatDate(row.startedAt, language)}</td>
                        <td className="py-3 pr-4 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {actions.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                onClick={() => updateStatusMutation.mutate({ runId: row.id, status: nextStatus })}
                                disabled={updateStatusMutation.isPending}
                                className="rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-300 transition hover:bg-slate-700/70 disabled:opacity-50"
                              >
                                {updateStatusMutation.isPending && statusUpdatingRunId === row.id
                                  ? t('forwardGate.actionUpdating')
                                  : actionLabel(nextStatus, t)}
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => openSummaryModal(row, 'view')}
                              className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-cyan-200 transition hover:bg-cyan-900/30"
                            >
                              {t('forwardGate.viewSummary')}
                            </button>
                            {row.summary ? (
                              <button
                                type="button"
                                onClick={() => openSummaryModal(row, 'edit')}
                                className="rounded-md border border-amber-700/50 bg-amber-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-amber-200 transition hover:bg-amber-900/30"
                              >
                                {t('forwardGate.editSummary')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openSummaryModal(row, 'add')}
                                className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-emerald-200 transition hover:bg-emerald-900/30"
                              >
                                {t('forwardGate.addSummary')}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openGateModal(row, 'view')}
                              className="rounded-md border border-indigo-700/50 bg-indigo-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-indigo-200 transition hover:bg-indigo-900/30"
                            >
                              {t('forwardGate.viewGateResult')}
                            </button>
                            {row.gateResult ? (
                              <button
                                type="button"
                                onClick={() => openGateModal(row, 'edit')}
                                className="rounded-md border border-purple-700/50 bg-purple-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-purple-200 transition hover:bg-purple-900/30"
                              >
                                {t('forwardGate.editGateResult')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openGateModal(row, 'add')}
                                className="rounded-md border border-violet-700/50 bg-violet-950/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-violet-200 transition hover:bg-violet-900/30"
                              >
                                {t('forwardGate.addGateResult')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-slate-900/30">
                        <td colSpan={7} className="pb-3 pl-3 pr-3">
                          {row.summary ? (
                            <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                              <SummaryCell label={t('forwardGate.totalTrades')} value={String(row.summary.totalTrades)} />
                              <SummaryCell label={t('forwardGate.winRate')} value={`${row.summary.winRate}%`} />
                              <SummaryCell label={t('forwardGate.pnl')} value={String(row.summary.pnl)} />
                              <SummaryCell label={t('forwardGate.maxDrawdown')} value={`${row.summary.maxDrawdown}%`} />
                              <SummaryCell label={t('forwardGate.expectancy')} value={String(row.summary.expectancy)} />
                              <SummaryCell label={t('forwardGate.coveredPeriod')} value={formatPeriod(row.summary.periodStart, row.summary.periodEnd)} />
                            </div>
                          ) : (
                            <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                              {t('forwardGate.noSummaryYet')}
                            </div>
                          )}

                          <div className="mt-2">
                            {row.gateResult ? (
                              <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
                                <SummaryCell label={t('forwardGate.gateDecision')} value={row.gateResult.gateDecision} />
                                <SummaryCell label={t('forwardGate.confidence')} value={row.gateResult.confidence || '--'} />
                                <SummaryCell label={t('forwardGate.hardFail')} value={row.gateResult.hardFail ? t('evaluation.yes') : t('evaluation.no')} />
                                <SummaryCell label={t('forwardGate.sampleAdequacy')} value={row.gateResult.sampleAdequacy || '--'} />
                                <SummaryCell label={t('forwardGate.evaluatedAt')} value={formatDate(row.gateResult.evaluatedAt, language)} />
                              </div>
                            ) : (
                              <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                                {t('forwardGate.noGateResultYet')}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TableShell>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState title={t('forwardGate.emptyForwardRunTitle')} description={t('forwardGate.emptyForwardRunDesc')} />
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">{t('forwardGate.gateListTitle')}</p>
          <div className="flex flex-wrap gap-1.5">
            {GATE_DECISION_FILTERS.map((decision) => (
              <button
                key={decision}
                type="button"
                onClick={() => onChangeGateFilter(decision)}
                className={`rounded-md border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                  gateDecisionFilter === decision
                    ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200'
                    : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                }`}
              >
                {decision === 'ALL' ? t('forwardGate.statusAll') : decision}
              </button>
            ))}
          </div>
        </div>

        {gateListLoading ? <LoadingState label={t('forwardGate.loadingGateList')} /> : null}
        {gateListError ? <ErrorState message={t('forwardGate.errorGateList')} /> : null}

        {!gateListLoading && !gateListError && gateRows.length > 0 ? (
          <TableShell
            title={t('forwardGate.gateListSubtitle')}
            subtitle={t('forwardGate.registrySubtitle', { page: gatePage, total: gateTotal })}
            page={gatePage}
            pageSize={GATE_PAGE_SIZE}
            total={gateTotal}
            onPageChange={setGatePage}
          >
            <p className="mb-3 text-xs text-slate-500 sm:hidden">{t('common.swipeForMore')}</p>
            <div className="overflow-x-auto pb-1">
              <table className="min-w-[1200px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">{t('forwardGate.colStrategy')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.forwardRun')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.gateDecision')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.confidence')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.hardFail')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.sampleAdequacy')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.strongestFactor')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.weakestFactor')}</th>
                    <th className="pb-3 pr-4">{t('forwardGate.evaluatedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {gateRows.map((item) => (
                    <tr key={item.id} className="text-slate-300 transition-colors hover:bg-slate-800/30">
                      <td className="py-3 pr-4 font-medium text-slate-100">{item.strategyName}</td>
                      <td className="py-3 pr-4">#{item.forwardRunId}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${gateDecisionClass(item.gateDecision)}`}>
                          {item.gateDecision}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{item.confidence || '--'}</td>
                      <td className="py-3 pr-4">{item.hardFail ? t('evaluation.yes') : t('evaluation.no')}</td>
                      <td className="py-3 pr-4">{item.sampleAdequacy || '--'}</td>
                      <td className="py-3 pr-4">{item.strongestFactor || '--'}</td>
                      <td className="py-3 pr-4">{item.weakestFactor || '--'}</td>
                      <td className="py-3 pr-4">{formatDate(item.evaluatedAt, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        ) : null}

        {!gateListLoading && !gateListError && gateRows.length === 0 ? (
          <EmptyState title={t('forwardGate.emptyGateResultTitle')} description={t('forwardGate.emptyGateResultDesc')} />
        ) : null}
      </div>

      {statusResult ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            statusResult.ok
              ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
              : 'border-rose-700/60 bg-rose-950/40 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <span>{statusResult.message}</span>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => setStatusResult(null)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {summaryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <h3 className="text-base font-semibold text-slate-100">
              {summaryModal.mode === 'add'
                ? t('forwardGate.addSummary')
                : summaryModal.mode === 'edit'
                  ? t('forwardGate.editSummary')
                  : t('forwardGate.viewSummary')}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{summaryModal.run.strategyName}</p>

            {summaryLoading ? (
              <p className="mt-4 text-sm text-slate-400">{t('forwardGate.loadingSummary')}</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryInput label={t('forwardGate.totalTrades')} value={summaryForm.totalTrades} onChange={(v) => setSummaryForm((p) => ({ ...p, totalTrades: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.winRate')} value={summaryForm.winRate} onChange={(v) => setSummaryForm((p) => ({ ...p, winRate: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.pnl')} value={summaryForm.pnl} onChange={(v) => setSummaryForm((p) => ({ ...p, pnl: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.maxDrawdown')} value={summaryForm.maxDrawdown} onChange={(v) => setSummaryForm((p) => ({ ...p, maxDrawdown: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.expectancy')} value={summaryForm.expectancy} onChange={(v) => setSummaryForm((p) => ({ ...p, expectancy: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.coveredPeriodStart')} value={summaryForm.periodStart} onChange={(v) => setSummaryForm((p) => ({ ...p, periodStart: v }))} readOnly={summaryModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.coveredPeriodEnd')} value={summaryForm.periodEnd} onChange={(v) => setSummaryForm((p) => ({ ...p, periodEnd: v }))} readOnly={summaryModal.mode === 'view'} />
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSummaryModal(null)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('forwardGate.close')}
              </button>
              {summaryModal.mode !== 'view' ? (
                <button
                  type="button"
                  onClick={submitSummary}
                  disabled={saveSummaryMutation.isPending}
                  className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-950/50 disabled:opacity-50"
                >
                  {saveSummaryMutation.isPending ? t('forwardGate.actionUpdating') : t('forwardGate.saveSummary')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {gateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <h3 className="text-base font-semibold text-slate-100">
              {gateModal.mode === 'add'
                ? t('forwardGate.addGateResult')
                : gateModal.mode === 'edit'
                  ? t('forwardGate.editGateResult')
                  : t('forwardGate.viewGateResult')}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{gateModal.run.strategyName}</p>

            {gateLoading ? (
              <p className="mt-4 text-sm text-slate-400">{t('forwardGate.loadingGateResult')}</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs text-slate-400">{t('forwardGate.gateDecision')}</span>
                  <select
                    value={gateForm.gateDecision}
                    onChange={(e) => setGateForm((p) => ({ ...p, gateDecision: e.target.value }))}
                    disabled={gateModal.mode === 'view'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 disabled:opacity-70"
                  >
                    {GATE_DECISION_FILTERS.filter((item) => item !== 'ALL').map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <SummaryInput label={t('forwardGate.confidence')} value={gateForm.confidence} onChange={(v) => setGateForm((p) => ({ ...p, confidence: v }))} readOnly={gateModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.sampleAdequacy')} value={gateForm.sampleAdequacy} onChange={(v) => setGateForm((p) => ({ ...p, sampleAdequacy: v }))} readOnly={gateModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.strongestFactor')} value={gateForm.strongestFactor} onChange={(v) => setGateForm((p) => ({ ...p, strongestFactor: v }))} readOnly={gateModal.mode === 'view'} />
                <SummaryInput label={t('forwardGate.weakestFactor')} value={gateForm.weakestFactor} onChange={(v) => setGateForm((p) => ({ ...p, weakestFactor: v }))} readOnly={gateModal.mode === 'view'} />
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs text-slate-400">{t('forwardGate.notes')}</span>
                  <textarea
                    rows={3}
                    value={gateForm.notes}
                    onChange={(e) => setGateForm((p) => ({ ...p, notes: e.target.value }))}
                    readOnly={gateModal.mode === 'view'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 read-only:opacity-70"
                  />
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={gateForm.hardFail}
                    onChange={(e) => setGateForm((p) => ({ ...p, hardFail: e.target.checked }))}
                    disabled={gateModal.mode === 'view'}
                  />
                  <span className="text-xs text-slate-300">{t('forwardGate.hardFail')}</span>
                </label>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGateModal(null)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                {t('forwardGate.close')}
              </button>
              {gateModal.mode !== 'view' ? (
                <button
                  type="button"
                  onClick={submitGateResult}
                  disabled={saveGateMutation.isPending}
                  className="rounded-md border border-indigo-700/50 bg-indigo-950/30 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-950/50 disabled:opacity-50"
                >
                  {saveGateMutation.isPending ? t('forwardGate.actionUpdating') : t('forwardGate.saveGateResult')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SummaryCell({ label, value }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  )
}

function SummaryInput({ label, value, onChange, readOnly }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 read-only:opacity-70"
      />
    </label>
  )
}

export default ForwardGatePage
