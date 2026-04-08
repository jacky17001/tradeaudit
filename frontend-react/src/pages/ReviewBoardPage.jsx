import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import { useLanguage } from '../i18n/LanguageContext'
import { queryKeys } from '../lib/queryKeys'
import { createFollowUpTask } from '../services/api/followUpTasks'
import { getReviewBoardSummary, getReviewBoardCases, getReviewStatusOptions } from '../services/api/reviewBoard'

function statusTone(status) {
  switch (status) {
    case 'open':
      return 'warning'
    case 'in_progress':
      return 'default'
    case 'closed':
      return 'success'
    case 'on_watch':
      return 'warning'
    default:
      return 'default'
  }
}

function priorityTone(priority) {
  switch (priority) {
    case 'high':
      return 'danger'
    case 'normal':
      return 'default'
    case 'low':
      return 'default'
    default:
      return 'default'
  }
}

function ReviewBoardPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState(null)
  const [caseTypeFilter, setCaseTypeFilter] = useState(null)
  const [priorityFilter, setPriorityFilter] = useState(null)
  const [taskFeedback, setTaskFeedback] = useState('')

  const taskMutation = useMutation({
    mutationFn: (payload) => createFollowUpTask(payload),
    onSuccess: () => {
      setTaskFeedback(t('followUpTasks.taskCreated'))
      queryClient.invalidateQueries({ queryKey: ['follow-up-tasks'] })
    },
    onError: () => setTaskFeedback(t('followUpTasks.taskCreateFailed')),
  })

  // Fetch summary
  const summaryQuery = useQuery({
    queryKey: queryKeys['review-board-summary'](),
    queryFn: () => getReviewBoardSummary(),
    staleTime: 1000 * 60,
  })

  // Fetch cases
  const casesQuery = useQuery({
    queryKey: queryKeys['review-board-cases'](limit, offset, statusFilter, caseTypeFilter, priorityFilter),
    queryFn: () =>
      getReviewBoardCases(limit, offset, statusFilter, caseTypeFilter, priorityFilter),
    staleTime: 1000 * 60,
  })

  // Fetch options
  const optionsQuery = useQuery({
    queryKey: queryKeys['review-board-options'](),
    queryFn: () => getReviewStatusOptions(),
    staleTime: 1000 * 60 * 5,
  })

  const summary = summaryQuery.data
  const cases = casesQuery.data
  const options = optionsQuery.data

  const totalPages = cases ? Math.ceil(cases.total / limit) : 1
  const currentPage = Math.floor(offset / limit) + 1

  const isLoading = summaryQuery.isLoading || casesQuery.isLoading

  if (isLoading) {
    return <LoadingState />
  }

  if (summaryQuery.isError || casesQuery.isError) {
    return (
      <ErrorState
        title={t('common.error')}
        message={t('common.failedToLoad')}
        onRetry={() => {
          summaryQuery.refetch()
          casesQuery.refetch()
        }}
      />
    )
  }

  const handleClearFilters = () => {
    setStatusFilter(null)
    setCaseTypeFilter(null)
    setPriorityFilter(null)
    setOffset(0)
  }

  const hasActiveFilters = statusFilter || caseTypeFilter || priorityFilter

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">
          {t('reviewBoard.title')}
        </h1>
        <p className="text-sm text-slate-400">
          {t('reviewBoard.subtitle')}
        </p>
        {taskFeedback ? <p className="text-xs text-cyan-300">{taskFeedback}</p> : null}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className="rounded-lg border border-slate-700 bg-slate-900 p-4 cursor-pointer hover:border-slate-600 transition"
            onClick={() => {
              setStatusFilter(null)
              setOffset(0)
            }}
          >
            <div className="text-xs text-slate-400 mb-1">{t('reviewBoard.allCases')}</div>
            <div className="text-2xl font-bold text-slate-100">{summary.total}</div>
          </div>

          {summary.statuses.map((status) => (
            <div
              key={status}
              className="rounded-lg border border-slate-700 bg-slate-900 p-4 cursor-pointer hover:border-slate-600 transition"
              onClick={() => {
                setStatusFilter(status)
                setOffset(0)
              }}
            >
              <div className="text-xs text-slate-400 mb-1 capitalize">
                {t(`reviewBoard.status.${status}`)}
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {summary.byStatus[status] || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {options && (
        <div className="border border-slate-700 rounded-lg bg-slate-900/50 p-4">
          <div className="text-sm font-semibold text-slate-100 mb-3">
            {t('common.filters')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status Filter */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">
                {t('reviewBoard.filterByStatus')}
              </label>
              <select
                value={statusFilter || ''}
                onChange={(e) => {
                  setStatusFilter(e.target.value || null)
                  setOffset(0)
                }}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm hover:border-slate-500 focus:outline-none focus:border-cyan-500"
              >
                <option value="">{t('common.all')}</option>
                {options.statuses.map((s) => (
                  <option key={s} value={s}>
                    {t(`reviewBoard.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Case Type Filter */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">
                {t('reviewBoard.filterByCaseType')}
              </label>
              <select
                value={caseTypeFilter || ''}
                onChange={(e) => {
                  setCaseTypeFilter(e.target.value || null)
                  setOffset(0)
                }}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm hover:border-slate-500 focus:outline-none focus:border-cyan-500"
              >
                <option value="">{t('common.all')}</option>
                {options.caseTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">
                {t('reviewBoard.filterByPriority')}
              </label>
              <select
                value={priorityFilter || ''}
                onChange={(e) => {
                  setPriorityFilter(e.target.value || null)
                  setOffset(0)
                }}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm hover:border-slate-500 focus:outline-none focus:border-cyan-500"
              >
                <option value="">{t('common.all')}</option>
                {options.priorities.map((p) => (
                  <option key={p} value={p}>
                    {t(`reviewBoard.priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3">
              <Button
                onClick={handleClearFilters}
                variant="secondary"
                size="sm"
              >
                {t('common.clearFilters')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cases List */}
      {cases && cases.items.length > 0 ? (
        <>
          <div className="border border-slate-700 rounded-lg bg-slate-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-950/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('reviewBoard.caseId')}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('reviewBoard.object')}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('reviewBoard.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('reviewBoard.priority')}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('common.created')}
                    </th>
                    <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                      {t('followUpTasks.createTask')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cases.items.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-700 hover:bg-slate-900/50 transition"
                    >
                      <td className="px-4 py-3 text-slate-200">#{c.id}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200">{c.object_label}</div>
                        {c.object_detail && (
                          <div className="text-xs text-slate-400 mt-1">
                            {c.object_detail.label}
                            {c.object_detail.symbol && (
                              <span className="ml-2">({c.object_detail.symbol})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(c.status)}>
                          {t(`reviewBoard.status.${c.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={priorityTone(c.priority)}>
                          {t(`reviewBoard.priority.${c.priority}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={taskMutation.isPending}
                          onClick={() => {
                            setTaskFeedback('')
                            taskMutation.mutate({
                              object_type: 'audit_case',
                              object_ref_id: c.id,
                              action_key: 'review_manually',
                              title: `${t('followUpTasks.reviewManually')} #${c.id}`,
                              priority: c.priority || 'normal',
                              due_label: c.priority === 'high' ? 'today' : 'this_week',
                              note: c.note || '',
                            })
                          }}
                        >
                          {t('followUpTasks.createTask')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-400">
              {t('common.showingRecords', {
                from: offset + 1,
                to: Math.min(offset + limit, cases.total),
                total: cases.total,
              })}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                variant="secondary"
                size="sm"
              >
                {t('common.previous')}
              </Button>
              <div className="px-3 py-2 text-slate-400">
                {currentPage} / {totalPages}
              </div>
              <Button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                variant="secondary"
                size="sm"
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center">
          <p className="text-slate-400 text-sm">
            {t('reviewBoard.noCasesFound')}
          </p>
        </div>
      )}
    </div>
  )
}

export default ReviewBoardPage
