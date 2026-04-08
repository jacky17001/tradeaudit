import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PublicLayout from './layout/PublicLayout'
import ProtectedRoute from './layout/ProtectedRoute'
import LoadingState from './components/ui/LoadingState'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import ResultOverviewPage from './pages/ResultOverviewPage'
import ScoringSummaryPage from './pages/ScoringSummaryPage'
import RecommendedActionsPage from './pages/RecommendedActionsPage'
import AccountAuditPage from './pages/AccountAuditPage'
import AuditCasesPage from './pages/AuditCasesPage'
import BacktestsPage from './pages/BacktestsPage'
import ForwardGatePage from './pages/ForwardGatePage'

const AuditReportPage = lazy(() => import('./pages/AuditReportPage'))
const ComparisonReportPage = lazy(() => import('./pages/ComparisonReportPage'))
const ReviewBoardPage = lazy(() => import('./pages/ReviewBoardPage'))
const FollowUpTasksPage = lazy(() => import('./pages/FollowUpTasksPage'))
const ReportSnapshotsPage = lazy(() => import('./pages/ReportSnapshotsPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))

function App() {
  return (
    <Suspense fallback={<LoadingState />}>
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
          <Route path="/follow-up-tasks" element={<FollowUpTasksPage />} />
          <Route path="/report-snapshots" element={<ReportSnapshotsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/audit-report" element={<AuditReportPage />} />
          <Route path="/comparison-report" element={<ComparisonReportPage />} />
          <Route path="/review-board" element={<ReviewBoardPage />} />
          <Route path="/account-audit" element={<AccountAuditPage />} />
          <Route path="/audit-cases" element={<AuditCasesPage />} />
          <Route path="/backtests" element={<BacktestsPage />} />
          <Route path="/forward-gate" element={<ForwardGatePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
