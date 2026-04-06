import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import TableShell from '../components/ui/TableShell'
import { queryKeys } from '../lib/queryKeys'
import { getBacktestsData } from '../services/api/backtests'

const PAGE_SIZE = 10

const DECISION_STYLES = {
  PASS: 'text-emerald-400 font-medium',
  NEEDS_IMPROVEMENT: 'text-amber-400 font-medium',
  FAIL: 'text-rose-400 font-medium',
}

function BacktestsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.backtests.list(page, PAGE_SIZE),
    queryFn: () => getBacktestsData(page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  })

  if (isLoading) {
    return <LoadingState label="Loading backtests data..." />
  }

  if (error) {
    return <ErrorState message="Failed to load backtests data." />
  }

  if (!data || data.rows.length === 0) {
    return <EmptyState title="No backtests found" description="Backtest records will appear here." />
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Backtest Review</p>
        <div className="flex items-center gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">Refreshing...</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.backtests.all })
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      <TableShell
        title="Backtest Results"
        subtitle={`Page ${page} · ${data.total} total records`}
        page={page}
        pageSize={PAGE_SIZE}
        total={data.total}
        onPageChange={setPage}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">Strategy</th>
                <th className="pb-3 pr-4">Symbol / TF</th>
                <th className="pb-3 pr-4 text-right">Return %</th>
                <th className="pb-3 pr-4 text-right">Win Rate</th>
                <th className="pb-3 pr-4 text-right">Max DD</th>
                <th className="pb-3 pr-4 text-right">PF</th>
                <th className="pb-3 pr-4 text-right">Score</th>
                <th className="pb-3 text-right">Decision</th>
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
                    {row.decision}
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
