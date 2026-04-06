export const endpoints = {
  health: '/api/health',
  dashboard: {
    summary: '/api/dashboard/summary',
  },
  audit: {
    summary: '/api/account-audit/summary',
  },
  backtests: {
    list: '/api/backtests/list',
    import: '/api/backtests/import',
  },
  forwardGate: {
    summary: '/api/forward-gate/summary',
  },
  evaluations: {
    history: '/api/evaluations/history',
  },
  importJobs: {
    list: '/api/import-jobs',
  },
} as const
