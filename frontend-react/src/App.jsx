import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PublicLayout from './layout/PublicLayout'
import ProtectedRoute from './layout/ProtectedRoute'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import ResultOverviewPage from './pages/ResultOverviewPage'
import ScoringSummaryPage from './pages/ScoringSummaryPage'
import RecommendedActionsPage from './pages/RecommendedActionsPage'
import AuditReportPage from './pages/AuditReportPage'
import ComparisonReportPage from './pages/ComparisonReportPage'
import AccountAuditPage from './pages/AccountAuditPage'
import AuditCasesPage from './pages/AuditCasesPage'
import BacktestsPage from './pages/BacktestsPage'
import ForwardGatePage from './pages/ForwardGatePage'

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/result-overview" element={<ResultOverviewPage />} />
        <Route path="/scoring-summary" element={<ScoringSummaryPage />} />
        <Route path="/recommended-actions" element={<RecommendedActionsPage />} />
        <Route path="/audit-report" element={<AuditReportPage />} />
        <Route path="/comparison-report" element={<ComparisonReportPage />} />
        <Route path="/account-audit" element={<AccountAuditPage />} />
        <Route path="/audit-cases" element={<AuditCasesPage />} />
        <Route path="/backtests" element={<BacktestsPage />} />
        <Route path="/forward-gate" element={<ForwardGatePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
