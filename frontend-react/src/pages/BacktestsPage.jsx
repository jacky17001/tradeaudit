import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import TableShell from '../components/ui/TableShell'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { getBacktestsData } from '../services/api/backtests'

const PAGE_SIZE = 10

const DECISION_STYLES = {
  PASS: 'text-emerald-400 font-medium',
  NEEDS_IMPROVEMENT: 'text-amber-400 font-medium',
  FAIL: 'text-rose-400 font-medium',
}

function BacktestsPage() {
  const { t, language } = useLanguage()
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.backtests.list(page, PAGE_SIZE),
    queryFn: () => getBacktestsData(page, PAGE_SIZE),
    placeholderData: (prev) => prev,
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
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">{t('backtests.strategy')}</th>
                <th className="pb-3 pr-4">{t('backtests.symbolTf')}</th>
                <th className="pb-3 pr-4 text-right">{t('backtests.returnPct')}</th>
                <th className="pb-3 pr-4 text-right">{t('backtests.winRate')}</th>
                <th className="pb-3 pr-4 text-right">{t('backtests.maxDd')}</th>
                <th className="pb-3 pr-4 text-right">{t('backtests.pf')}</th>
                <th className="pb-3 pr-4 text-right">{t('backtests.score')}</th>
                <th className="pb-3 text-right">{t('backtests.decision')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.rows.map((row) => (
                <tr key={row.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
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
                  <td className="py-3 pr-4 text-right">{row.score}</td>
                  <td className={`py-3 text-right ${DECISION_STYLES[row.decision] ?? 'text-slate-400'}`}>
                    {language === 'zh'
                      ? row.decision === 'PASS'
                        ? '通过'
                        : row.decision === 'FAIL'
                          ? '失败'
                          : '需改进'
                      : row.decision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>
    </div>
  )
}

export default BacktestsPage
