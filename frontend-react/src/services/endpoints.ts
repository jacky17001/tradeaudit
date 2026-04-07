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
    candidate: (strategyId: string) => `/api/backtests/${strategyId}/candidate`,
    lifecycle: (strategyId: string) => `/api/backtests/${strategyId}/lifecycle`,
    import: '/api/backtests/import',
    importUpload: '/api/backtests/import-upload',
  },
  forwardGate: {
    summary: '/api/forward-gate/summary',
  },
  forwardRuns: {
    list: '/api/forward-runs',
    updateStatus: (runId: number) => `/api/forward-runs/${runId}/status`,
    gateResult: (runId: number) => `/api/forward-runs/${runId}/gate-result`,
  },
  gateResults: {
    list: '/api/gate-results',
  },
  evaluations: {
    history: '/api/evaluations/history',
  },
  importJobs: {
    list: '/api/import-jobs',
    changes: (jobId: number) => `/api/import-jobs/${jobId}/changes`,
    activate: (jobId: number) => `/api/import-jobs/${jobId}/activate`,
    compare: '/api/import-jobs/compare',
  },
  backtestsActiveDataset: '/api/backtests/active-dataset',
} as const
