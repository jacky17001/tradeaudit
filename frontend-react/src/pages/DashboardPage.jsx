import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import { queryKeys } from '../lib/queryKeys'
import { getDashboardData } from '../services/api/dashboard'

function DashboardPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: getDashboardData,
  })

  if (isLoading) {
    return <LoadingState label="Loading dashboard metrics..." />
  }

  if (error) {
    return <ErrorState message="Failed to load dashboard data." />
  }

  if (!data || data.metrics.length === 0) {
    return <EmptyState title="No dashboard data" description="Metrics will appear when data is available." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Dashboard Summary</p>
        <div className="flex items-center gap-3">
          {isFetching ? <span className="text-xs text-cyan-300">Refreshing...</span> : null}
          <Button
            variant="secondary"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Report Pipeline" subtitle="Latest milestones">
          <ul className="space-y-2 text-sm text-slate-300">
            {data.reportPipeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Operational Focus" subtitle="This sprint">
          <ul className="space-y-2 text-sm text-slate-300">
            {data.operationalFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

export default DashboardPage
