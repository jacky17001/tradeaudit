export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
  },
  audit: {
    all: ['audit'] as const,
    intakeJobs: (limit: number) => ['audit', 'intake-jobs', limit] as const,
    mt5Connections: (limit: number) => ['audit', 'mt5-connections', limit] as const,
    mt5Connection: (connectionId: number) => ['audit', 'mt5-connection', connectionId] as const,
    summaries: (sourceType: string | null, limit: number) => ['audit', 'summaries', sourceType, limit] as const,
    summary: (summaryId: number) => ['audit', 'summary', summaryId] as const,
    review: (sourceType: string, sourceRefId: number) => ['audit', 'review', sourceType, sourceRefId] as const,
    timeline: (sourceType: string, sourceRefId: number, limit: number) =>
      ['audit', 'timeline', sourceType, sourceRefId, limit] as const,
  },
  backtests: {
    all: ['backtests'] as const,
    list: (page: number, pageSize: number, candidateOnly: boolean) =>
      ['backtests', 'list', page, pageSize, candidateOnly] as const,
    activeDataset: ['backtests', 'active-dataset'] as const,
    lifecycle: (strategyId: string) => ['backtests', 'lifecycle', strategyId] as const,
    timeline: (strategyId: string, limit: number) => ['backtests', 'timeline', strategyId, limit] as const,
  },
  forwardGate: {
    all: ['forward-gate'] as const,
  },
  forwardRuns: {
    all: ['forward-runs'] as const,
    list: (status: string, page: number, pageSize: number) =>
      ['forward-runs', 'list', status, page, pageSize] as const,
  },
  gateResults: {
    all: ['gate-results'] as const,
    list: (decision: string, page: number, pageSize: number) =>
      ['gate-results', 'list', decision, page, pageSize] as const,
  },
  evaluations: {
    history: (entityType: string, entityId: string, limit: number) =>
      ['evaluations', 'history', entityType, entityId, limit] as const,
  },
  importJobs: {
    recent: (limit: number) => ['import-jobs', 'recent', limit] as const,
    changes: (jobId: number, changeType?: string) => ['import-jobs', 'changes', jobId, changeType ?? null] as const,
    compare: (leftJobId: number, rightJobId: number) => ['import-jobs', 'compare', leftJobId, rightJobId] as const,
  },
  auditCases: {
    list: (status?: string, priority?: string) => ['audit-cases', 'list', status ?? null, priority ?? null] as const,
    detail: (caseId: number) => ['audit-cases', 'detail', caseId] as const,
    queue: () => ['audit-cases', 'queue'] as const,
    summary: () => ['audit-cases', 'summary'] as const,
    notes: (caseId: number) => ['audit-cases', 'notes', caseId] as const,
    actions: (caseId: number) => ['audit-cases', 'actions', caseId] as const,
    decision: (caseId: number) => ['audit-cases', 'decision', caseId] as const,
    timeline: (caseId: number, limit: number) => ['audit-cases', 'timeline', caseId, limit] as const,
  },
}
