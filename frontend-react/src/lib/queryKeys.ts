export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
  },
  audit: {
    all: ['audit'] as const,
  },
  backtests: {
    all: ['backtests'] as const,
    list: (page: number, pageSize: number) => ['backtests', 'list', page, pageSize] as const,
  },
  forwardGate: {
    all: ['forward-gate'] as const,
  },
  evaluations: {
    history: (entityType: string, entityId: string, limit: number) =>
      ['evaluations', 'history', entityType, entityId, limit] as const,
  },
  importJobs: {
    recent: (limit: number) => ['import-jobs', 'recent', limit] as const,
  },
}
