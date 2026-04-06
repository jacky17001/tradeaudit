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
  },
  forwardGate: {
    summary: '/api/forward-gate/summary',
  },
} as const
