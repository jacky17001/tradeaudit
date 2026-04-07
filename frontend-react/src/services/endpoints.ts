export const endpoints = {
  health: '/api/health',
  auth: {
    login: '/api/auth/login',
    verify: '/api/auth/verify',
  },
  dashboard: {
    summary: '/api/dashboard/summary',
  },
  audit: {
    summary: '/api/account-audit/summary',
    intake: '/api/account-audit/intake',
    intakeUpload: '/api/account-audit/intake-upload',
    intakeJobs: '/api/account-audit/intake-jobs',
    mt5TestConnection: '/api/account-audit/mt5/test-connection',
    mt5Connect: '/api/account-audit/mt5/connect',
    mt5Connections: '/api/account-audit/mt5/connections',
    mt5Connection: (connectionId: number) => `/api/account-audit/mt5/${connectionId}`,
    mt5Sync: (connectionId: number) => `/api/account-audit/mt5/${connectionId}/sync`,
    summariesRecompute: '/api/account-audit/summaries/recompute',
    summaries: '/api/account-audit/summaries',
    summary: (summaryId: number) => `/api/account-audit/summaries/${summaryId}`,
    review: '/api/account-audit/review',
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
