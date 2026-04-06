import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../components/SectionCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import StatCard from '../components/ui/StatCard'
import { queryKeys } from '../lib/queryKeys'
import { getAuditData } from '../services/api/audit'

function AccountAuditPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.audit.all,
    queryFn: getAuditData,
  })

  if (isLoading) {
    return <LoadingState label="Loading account audit data..." />
  }

  if (error) {
    return <ErrorState message="Failed to load account audit data." />
  }

  if (!data) {
    return (
      <EmptyState
        title="No audit data"
        description="Connect an account or provide sample data to continue."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Account Audit</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.accountName} · {data.broker}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">Refreshing...</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.audit.all })
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Balance & Equity */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Balance" value={`$${data.balance.toLocaleString()}`} />
        <StatCard label="Equity" value={`$${data.equity.toLocaleString()}`} />
        <StatCard label="Risk Score" value={`${data.riskScore} / 100`} tone="accent" />
        <StatCard label="Profit Factor" value={String(data.profitFactor)} />
      </div>

      {/* Risk metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <SectionCard title="Performance Metrics" subtitle="Core trading statistics">
          <div className="space-y-3">
            <MetricRow label="Win Rate" value={`${data.winRate}%`} />
            <MetricRow label="Max Drawdown" value={`${data.maxDrawdown}%`} warn={data.maxDrawdown > 10} />
            <MetricRow label="Profit Factor" value={String(data.profitFactor)} />
          </div>
        </SectionCard>

        <SectionCard title="AI Explanation" subtitle="Interpretability layer">
          <p className="text-sm leading-7 text-slate-300">{data.aiExplanation}</p>
        </SectionCard>
      </div>
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
