import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import ActivityTimeline from '../components/ui/ActivityTimeline'
import { useLanguage } from '../i18n/LanguageContext'
import { asText, downloadMarkdown, formatGeneratedAt, timelineLines } from '../lib/exportUtils'
import { queryKeys } from '../lib/queryKeys'
import {
  listAuditCases,
  createAuditCase,
  getAuditCase,
  updateAuditCase,
  getReviewQueue,
  getCaseSummary,
} from '../services/api/auditCases'
import {
  addNoteToCase,
  getNotesForCase,
  takeActionOnCase,
  getCaseDecision,
} from '../services/api/review'
import { getCaseTimeline } from '../services/api/timeline'

const CASE_TYPE_OPTIONS = ['strategy', 'backtest', 'account_audit', 'mt5_connection', 'forward_run']
const PRIORITY_OPTIONS = ['high', 'normal', 'low']
const STATUS_OPTIONS = ['open', 'in_progress', 'closed', 'on_watch']

const CASE_TYPE_LABELS = {
  strategy: 'auditCases.caseTypeStrategy',
  backtest: 'auditCases.caseTypeBacktest',
  account_audit: 'auditCases.caseTypeAccountAudit',
  mt5_connection: 'auditCases.caseTypeMt5Connection',
  forward_run: 'auditCases.caseTypeForwardRun',
}

const PRIORITY_LABELS = {
  high: 'auditCases.priorityHigh',
  normal: 'auditCases.priorityNormal',
  low: 'auditCases.priorityLow',
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AuditCasesPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('queue')
  const [statusFilter, setStatusFilter] = useState()
  const [priorityFilter, setPriorityFilter] = useState()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedCase, setSelectedCase] = useState(null)
  const [createFormData, setCreateFormData] = useState({
    case_type: 'strategy',
    ref_id: '',
    priority: 'normal',
    note: '',
  })
  const [updateFormData, setUpdateFormData] = useState({
    priority: '',
    status: '',
    note: '',
  })
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState('comment')
  const [noteError, setNoteError] = useState('')
  const [actionType, setActionType] = useState('approve')
  const [actionReason, setActionReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [exportMessage, setExportMessage] = useState('')

  // Queries
  const { data: casesData, isLoading: casesLoading, error: casesError } = useQuery({
    queryKey: queryKeys.auditCases.list(statusFilter, priorityFilter),
    queryFn: () => listAuditCases(50, statusFilter, priorityFilter),
  })

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: queryKeys.auditCases.queue(),
    queryFn: () => getReviewQueue(50),
  })

  const { data: summaryData } = useQuery({
    queryKey: queryKeys.auditCases.summary(),
    queryFn: () => getCaseSummary(),
  })

  const { data: caseDetail, isLoading: caseDetailLoading } = useQuery({
    queryKey: queryKeys.auditCases.detail(selectedCase?.id ?? 0),
    queryFn: () => (selectedCase ? getAuditCase(selectedCase.id) : null),
    enabled: selectedCase !== null,
  })

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: queryKeys.auditCases.notes(selectedCase?.id ?? 0),
    queryFn: () => getNotesForCase(selectedCase.id),
    enabled: selectedCase !== null,
  })

  const { data: decisionData } = useQuery({
    queryKey: queryKeys.auditCases.decision(selectedCase?.id ?? 0),
    queryFn: () => getCaseDecision(selectedCase.id),
    enabled: selectedCase !== null,
  })

  const { data: caseTimelineData, isLoading: caseTimelineLoading } = useQuery({
    queryKey: queryKeys.auditCases.timeline(selectedCase?.id ?? 0, 30),
    queryFn: () => getCaseTimeline(selectedCase.id, 30),
    enabled: selectedCase !== null,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => {
      const refId = parseInt(createFormData.ref_id, 10)
      if (isNaN(refId)) throw new Error('Invalid ref_id')
      return createAuditCase({
        case_type: createFormData.case_type,
        ref_id: refId,
        priority: createFormData.priority,
        note: createFormData.note || undefined,
      })
    },
    onSuccess: (newCase) => {
      setShowCreateForm(false)
      setCreateFormData({ case_type: 'strategy', ref_id: '', priority: 'normal', note: '' })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.queue() })
      setSelectedCase(newCase)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedCase) throw new Error('No case selected')
      const updates = {}
      if (updateFormData.priority) updates.priority = updateFormData.priority
      if (updateFormData.status) updates.status = updateFormData.status
      if (updateFormData.note !== undefined) updates.note = updateFormData.note
      return updateAuditCase(selectedCase.id, updates)
    },
    onSuccess: (updated) => {
      setSelectedCase(updated)
      setUpdateFormData({ priority: '', status: '', note: '' })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.queue() })
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: () => {
      if (!selectedCase) throw new Error('No case selected')
      return addNoteToCase(selectedCase.id, noteContent, noteType)
    },
    onSuccess: () => {
      setNoteContent('')
      setNoteError('')
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.notes(selectedCase.id) })
    },
    onError: () => {
      setNoteError('Failed to save note. Please try again.')
    },
  })

  const takeActionMutation = useMutation({
    mutationFn: () => {
      if (!selectedCase) throw new Error('No case selected')
      return takeActionOnCase(selectedCase.id, actionType, actionReason || undefined)
    },
    onSuccess: (result) => {
      setActionReason('')
      setActionError('')
      if (result.new_status) {
        const updated = { ...selectedCase, status: result.new_status }
        setSelectedCase(updated)
      }
      const caseId = selectedCase.id
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.decision(caseId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.detail(caseId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.queue() })
      queryClient.invalidateQueries({ queryKey: queryKeys.auditCases.summary() })
    },
    onError: () => {
      setActionError('Failed to record action. Please try again.')
    },
  })

  const displayData = activeTab === 'queue' ? queueData?.items : casesData?.items || []
  const isLoading = activeTab === 'queue' ? queueLoading : casesLoading

  const handleExportCase = () => {
    try {
      if (!caseDetail && !decisionData && !notesData) {
        setExportMessage(t('export.nothingToExport'))
        return
      }

      const latestNote = notesData?.items?.[0]
      const lines = [
        `# ${t('export.exportCase')}`,
        '',
        `- ${t('export.generatedAt')}: ${formatGeneratedAt()}`,
        '',
        '## Object',
        `- Case ID: ${asText(caseDetail?.id || selectedCase?.id)}`,
        `- Type: ${asText(caseDetail?.case_type || selectedCase?.case_type)}`,
        `- Ref ID: ${asText(caseDetail?.ref_id || selectedCase?.ref_id)}`,
        '',
        '## Current Status / Decision',
        `- Case Status: ${asText(caseDetail?.status || selectedCase?.status)}`,
        `- Latest Decision: ${asText(decisionData?.action)}`,
        `- Decision Reason: ${asText(decisionData?.reason)}`,
        '',
        '## Summary Metrics',
        `- Notes Count: ${asText(notesData?.count, '0')}`,
        `- Timeline Events: ${asText(caseTimelineData?.items?.length, '0')}`,
        '',
        '## Latest Action / Note',
        `- Latest Action: ${asText(decisionData?.action)}`,
        `- Latest Note: ${asText(latestNote?.content)}`,
        '',
        '## Timeline (Recent)',
        ...timelineLines(caseTimelineData?.items || [], 10),
      ]

      downloadMarkdown(`audit-case-${asText(caseDetail?.id || selectedCase?.id, 'id')}`, `${lines.join('\n')}\n`)
      setExportMessage(t('export.exportReady'))
    } catch {
      setExportMessage(t('export.exportFailed'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Audit Cases & Review Queue</p>
          <p className="text-xs text-slate-500 mt-0.5">Manage audit cases and track review priorities</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} variant="primary">
          + New Case
        </Button>
      </div>

      {/* Stats Cards */}
      {summaryData && (
        <div className="grid gap-3 sm:grid-cols-5">
          <StatCard label="Total" value={summaryData.total} />
          <StatCard label="Open" value={summaryData.open} tone="accent" />
          <StatCard label="In Progress" value={summaryData.in_progress} tone="info" />
          <StatCard label="On Watch" value={summaryData.on_watch} tone="secondary" />
          <StatCard label="Closed" value={summaryData.closed} tone="success" />
        </div>
      )}

      {/* Tab Selection */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => {
            setActiveTab('queue')
            setSelectedCase(null)
          }}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            activeTab === 'queue'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Review Queue ({queueData?.count || 0})
        </button>
        <button
          onClick={() => {
            setActiveTab('list')
            setSelectedCase(null)
          }}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            activeTab === 'list'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          All Cases ({casesData?.total || 0})
        </button>
      </div>

      {/* Filters for List Tab */}
      {activeTab === 'list' && (
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || undefined)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter || ''}
            onChange={(e) => setPriorityFilter(e.target.value || undefined)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
          >
            <option value="">All Priority</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content - List or Detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cases List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <LoadingState label="Loading cases..." />
          ) : !displayData || displayData.length === 0 ? (
            <EmptyState title="No cases" description="Create your first audit case" />
          ) : (
            <div className="space-y-2">
              {displayData.map((auditCase) => (
                <button
                  key={auditCase.id}
                  onClick={() => setSelectedCase(auditCase)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedCase?.id === auditCase.id
                      ? 'border-cyan-600 bg-cyan-950/30 shadow-lg shadow-cyan-950/30'
                      : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300 truncate">
                      #{auditCase.id} {auditCase.case_type}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      auditCase.priority === 'high'
                        ? 'border border-rose-700/30 bg-rose-950/20 text-rose-300'
                        : auditCase.priority === 'low'
                          ? 'border border-slate-700/30 bg-slate-800/20 text-slate-400'
                          : 'border border-cyan-700/30 bg-cyan-950/20 text-cyan-300'
                    }`}>
                      {auditCase.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">#{auditCase.ref_id}</p>
                  <span className={`inline-block mt-1 rounded px-2 py-0.5 text-[10px] font-medium ${
                    auditCase.status === 'closed'
                      ? 'border border-emerald-700/30 bg-emerald-950/20 text-emerald-300'
                      : auditCase.status === 'in_progress'
                        ? 'border border-blue-700/30 bg-blue-950/20 text-blue-300'
                        : 'border border-amber-700/30 bg-amber-950/20 text-amber-300'
                  }`}>
                    {auditCase.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Case Detail */}
        <div className="lg:col-span-2">
          {!selectedCase ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 h-full flex items-center justify-center">
              <p className="text-sm text-slate-400">Select a case to view details</p>
            </div>
          ) : caseDetailLoading ? (
            <LoadingState label="Loading case details..." />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-100">
                    Case #{caseDetail?.id}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCase}
                      className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-900/30"
                    >
                      {t('export.exportCase')}
                    </button>
                    <button
                      onClick={() => setSelectedCase(null)}
                      className="text-slate-400 hover:text-slate-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {exportMessage ? <p className="mb-2 text-xs text-emerald-300">{exportMessage}</p> : null}

                <div className="grid gap-2 sm:grid-cols-2 mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Type</p>
                    <p className="mt-1 text-sm font-medium text-slate-100">{caseDetail?.case_type}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Ref ID</p>
                    <p className="mt-1 text-sm font-medium text-slate-100">#{caseDetail?.ref_id}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Created</p>
                    <p className="mt-1 text-xs text-slate-300">{formatDate(caseDetail?.created_at)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Updated</p>
                    <p className="mt-1 text-xs text-slate-300">{formatDate(caseDetail?.updated_at)}</p>
                  </div>
                </div>

                {caseDetail?.note && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 mb-4">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Note</p>
                    <p className="mt-1 text-sm text-slate-300">{caseDetail.note}</p>
                  </div>
                )}
              </div>

              {/* Update Form */}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-100">Update Case</h4>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Priority</span>
                    <select
                      value={updateFormData.priority}
                      onChange={(e) =>
                        setUpdateFormData((prev) => ({ ...prev, priority: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    >
                      <option value="">No change</option>
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Status</span>
                    <select
                      value={updateFormData.status}
                      onChange={(e) =>
                        setUpdateFormData((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    >
                      <option value="">No change</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Note</span>
                  <textarea
                    value={updateFormData.note}
                    onChange={(e) =>
                      setUpdateFormData((prev) => ({ ...prev, note: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    placeholder="Add or update note..."
                  />
                </label>

                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  size="sm"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update Case'}
                </Button>
              </div>

              {/* ── Latest Decision ── */}
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-100">{t('auditCases.latestDecision')}</h4>
                {decisionData ? (
                  decisionData.has_decision ? (
                    <div className="rounded-lg border border-violet-700/30 bg-violet-950/20 p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${
                          decisionData.action === 'approve'
                            ? 'border border-emerald-700/40 bg-emerald-950/30 text-emerald-300'
                            : decisionData.action === 'reject'
                              ? 'border border-rose-700/40 bg-rose-950/30 text-rose-300'
                              : decisionData.action === 'watch'
                                ? 'border border-amber-700/40 bg-amber-950/30 text-amber-300'
                                : 'border border-blue-700/40 bg-blue-950/30 text-blue-300'
                        }`}>
                          {decisionData.action}
                        </span>
                        <span className="text-slate-400">{t('auditCases.decidedBy')} {decisionData.decided_by}</span>
                      </div>
                      {decisionData.reason && (
                        <p className="text-slate-300 italic">"{decisionData.reason}"</p>
                      )}
                      <p className="text-slate-500">{formatDate(decisionData.decided_at)}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-slate-500">{t('auditCases.currentStatus')}:</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          caseDetail?.status === 'closed'
                            ? 'border border-emerald-700/30 bg-emerald-950/20 text-emerald-300'
                            : caseDetail?.status === 'on_watch'
                              ? 'border border-amber-700/30 bg-amber-950/20 text-amber-300'
                              : 'border border-slate-700/30 bg-slate-800/20 text-slate-300'
                        }`}>
                          {caseDetail?.status ?? selectedCase?.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">{t('auditCases.noDecisionYet')}</p>
                  )
                ) : (
                  <p className="text-xs text-slate-500 italic">Loading...</p>
                )}
              </div>

              {/* ── Take Action ── */}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-100">{t('auditCases.takeAction')}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">{t('auditCases.action')}</span>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    >
                      <option value="approve">{t('auditCases.actionApprove')}</option>
                      <option value="reject">{t('auditCases.actionReject')}</option>
                      <option value="watch">{t('auditCases.actionWatch')}</option>
                      <option value="needs_data">{t('auditCases.actionNeedsData')}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">{t('auditCases.actionReason')}</span>
                    <input
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                      placeholder={t('auditCases.actionReasonPlaceholder')}
                    />
                  </label>
                </div>
                {actionError && (
                  <p className="text-xs text-rose-300 rounded border border-rose-800/40 bg-rose-950/20 px-2 py-1">{actionError}</p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => takeActionMutation.mutate()}
                    disabled={takeActionMutation.isPending}
                    size="sm"
                  >
                    {takeActionMutation.isPending ? t('auditCases.recordingAction') : t('auditCases.recordAction')}
                  </Button>
                  {takeActionMutation.isSuccess && (
                    <span className="text-xs text-emerald-300">{t('auditCases.actionSaved')}</span>
                  )}
                </div>
              </div>

              {/* ── Add Note ── */}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-100">{t('auditCases.addNote')}</h4>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    placeholder={t('auditCases.noteTypePlaceholder')}
                  />
                  <label className="block self-start">
                    <span className="mb-1 block text-xs text-slate-400">{t('auditCases.noteType')}</span>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-500"
                    >
                      <option value="comment">{t('auditCases.noteTypeComment')}</option>
                      <option value="flag">{t('auditCases.noteTypeFlag')}</option>
                      <option value="question">{t('auditCases.noteTypeQuestion')}</option>
                    </select>
                  </label>
                </div>
                {noteError && (
                  <p className="text-xs text-rose-300 rounded border border-rose-800/40 bg-rose-950/20 px-2 py-1">{noteError}</p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={addNoteMutation.isPending || !noteContent.trim()}
                    size="sm"
                  >
                    {addNoteMutation.isPending ? t('auditCases.savingNote') : t('auditCases.saveNote')}
                  </Button>
                  {addNoteMutation.isSuccess && (
                    <span className="text-xs text-emerald-300">{t('auditCases.noteSaved')}</span>
                  )}
                </div>
              </div>

              {/* ── Notes List ── */}
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-100">
                  {t('auditCases.notes')}
                  {notesData && notesData.count > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-500">({notesData.count})</span>
                  )}
                </h4>
                {notesLoading ? (
                  <p className="text-xs text-slate-500">Loading notes...</p>
                ) : !notesData || notesData.count === 0 ? (
                  <p className="text-xs text-slate-500 italic">{t('auditCases.noNotesYet')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {notesData.items.map((note) => (
                      <div key={note.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            note.note_type === 'flag'
                              ? 'border border-rose-700/40 bg-rose-950/20 text-rose-300'
                              : note.note_type === 'question'
                                ? 'border border-amber-700/40 bg-amber-950/20 text-amber-300'
                                : 'border border-slate-700/40 bg-slate-800/20 text-slate-400'
                          }`}>
                            {note.note_type}
                          </span>
                          <span className="text-slate-500">{formatDate(note.created_at)} · {note.created_by}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4">
                <ActivityTimeline
                  title={t('timeline.timeline')}
                  items={caseTimelineData?.items || []}
                  isLoading={caseTimelineLoading}
                  t={t}
                  language={language}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">{t('auditCases.createCaseTitle')}</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('auditCases.caseType')}</span>
                <select
                  value={createFormData.case_type}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, case_type: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                >
                  {CASE_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {t(CASE_TYPE_LABELS[type] || 'auditCases.caseTypeStrategy')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('auditCases.refId')}</span>
                <input
                  type="number"
                  value={createFormData.ref_id}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, ref_id: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                  placeholder={t('auditCases.objectId')}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('auditCases.priority')}</span>
                <select
                  value={createFormData.priority}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, priority: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {t(PRIORITY_LABELS[p] || 'auditCases.priorityNormal')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">{t('auditCases.noteLabel')}</span>
                <textarea
                  value={createFormData.note}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({ ...prev, note: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                  placeholder={t('auditCases.addNotesPlaceholder')}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => {
                    setShowCreateForm(false)
                    setCreateFormData({
                      case_type: 'strategy',
                      ref_id: '',
                      priority: 'normal',
                      note: '',
                    })
                  }}
                  variant="secondary"
                >
                  {t('auditCases.cancel')}
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !createFormData.ref_id}
                >
                  {createMutation.isPending ? t('auditCases.creating') : t('auditCases.create')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone = 'primary' }) {
  const toneClass = {
    primary: 'border-slate-700 bg-slate-900 text-slate-100',
    accent: 'border-rose-700/30 bg-rose-950/20 text-rose-200',
    info: 'border-blue-700/30 bg-blue-950/20 text-blue-200',
    secondary: 'border-amber-700/30 bg-amber-950/20 text-amber-200',
    success: 'border-emerald-700/30 bg-emerald-950/20 text-emerald-200',
  }[tone]

  return (
    <div className={`rounded-lg border ${toneClass} p-3 text-center`}>
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

export default AuditCasesPage
