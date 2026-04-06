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
}
