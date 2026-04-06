import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function tradeauditApiMockPlugin() {
  return {
    name: 'tradeaudit-api-mock',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            status: 'ok',
            service: 'tradeaudit-api',
          }),
        )
      })

      server.middlewares.use('/api/dashboard/summary', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            totalAudits: 128,
            averageScore: 74,
            passRate: 61,
            recentReports: 12,
          }),
        )
      })

      server.middlewares.use('/api/account-audit/summary', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            accountName: 'Demo Account',
            broker: 'Vantage Demo',
            balance: 10000,
            equity: 9875,
            riskScore: 72,
            maxDrawdown: 8.4,
            winRate: 58,
            profitFactor: 1.31,
            aiExplanation:
              'Risk profile is acceptable, but drawdown control and consistency can be improved.',
          }),
        )
      })

      server.middlewares.use('/api/forward-gate/summary', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            strategyName: 'TrendFibPA_v7',
            symbol: 'XAUUSD',
            forwardStatus: 'RUNNING',
            gateDecision: 'PENDING',
            lastUpdated: '2026-04-06 14:20',
            tradesObserved: 18,
            passRate: 55,
            maxDrawdown: 6.8,
            summary:
              'Forward validation is in progress. More observed trades are needed before final gate decision.',
          }),
        )
      })

      server.middlewares.use('/api/backtests/list', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            items: [
              {
                id: 'bt-001',
                name: 'TrendFibPA_v7',
                symbol: 'XAUUSD',
                timeframe: 'H1',
                returnPct: 9.88,
                winRate: 37.63,
                maxDrawdown: 11.14,
                profitFactor: 1.16,
                score: 57,
                decision: 'NEEDS_IMPROVEMENT',
              },
              {
                id: 'bt-002',
                name: 'TrendFibPA_v8',
                symbol: 'EURUSD',
                timeframe: 'H1',
                returnPct: 12.45,
                winRate: 44.2,
                maxDrawdown: 8.1,
                profitFactor: 1.42,
                score: 71,
                decision: 'PASS',
              },
              {
                id: 'bt-003',
                name: 'MeanRevert_M5',
                symbol: 'GBPUSD',
                timeframe: 'M15',
                returnPct: 15.3,
                winRate: 52.1,
                maxDrawdown: 6.2,
                profitFactor: 1.68,
                score: 79,
                decision: 'PASS',
              },
              {
                id: 'bt-004',
                name: 'LondonBreakout_X',
                symbol: 'USDJPY',
                timeframe: 'H4',
                returnPct: 7.5,
                winRate: 43.0,
                maxDrawdown: 9.9,
                profitFactor: 1.08,
                score: 65,
                decision: 'NEEDS_IMPROVEMENT',
              },
            ],
            page: 1,
            pageSize: 10,
            total: 24,
          }),
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tradeauditApiMockPlugin()],
})
