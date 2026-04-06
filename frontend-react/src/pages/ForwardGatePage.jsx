import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../components/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import StatCard from '../components/ui/StatCard'
import { queryKeys } from '../lib/queryKeys'
import { getForwardGateData } from '../services/api/forwardGate'

const FORWARD_STATUS_TONE = {
  RUNNING: 'accent',
  PAUSED: 'warning',
  COMPLETED: 'success',
}

const GATE_DECISION_TONE = {
  PASS: 'success',
  PENDING: 'warning',
  FAIL: 'danger',
}

function ForwardGatePage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.forwardGate.all,
    queryFn: getForwardGateData,
  })

  if (isLoading) {
    return <LoadingState label="Loading forward/gate status..." />
  }

  if (error) {
    return <ErrorState message="Failed to load forward/gate data." />
  }

  if (!data) {
    return <EmptyState title="No forward data" description="Forward status will appear here." />
  }

  const statusTone = FORWARD_STATUS_TONE[data.forwardStatus] ?? 'default'
  const decisionTone = GATE_DECISION_TONE[data.gateDecision] ?? 'default'

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Forward / Gate</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.strategyName} · {data.symbol}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching ? (
            <span className="text-xs text-cyan-300">Refreshing...</span>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.forwardGate.all })
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trades Observed" value={String(data.tradesObserved)} />
        <StatCard label="Pass Rate" value={`${data.passRate}%`} />
        <StatCard
          label="Max Drawdown"
          value={`${data.maxDrawdown}%`}
          tone={data.maxDrawdown > 10 ? 'danger' : undefined}
        />
        <StatCard label="Last Updated" value={data.lastUpdated} />
      </div>

      {/* Status badges + summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Validation Status" subtitle="Live forward test state">
          <div className="space-y-4">
            <StatusRow label="Forward Status">
              <Badge tone={statusTone}>{data.forwardStatus}</Badge>
            </StatusRow>
            <StatusRow label="Gate Decision">
              <Badge tone={decisionTone}>{data.gateDecision}</Badge>
            </StatusRow>
          </div>
        </SectionCard>

        <SectionCard title="Summary" subtitle="Interpretation">
          <p className="text-sm leading-7 text-slate-300">{data.summary}</p>
        </SectionCard>
      </div>
    </div>
  )
}

function StatusRow({ label, children }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      {children}
    </div>
  )
}

export default ForwardGatePage
