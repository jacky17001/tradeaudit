import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PublicLayout from './layout/PublicLayout'
import ProtectedRoute from './layout/ProtectedRoute'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import AccountAuditPage from './pages/AccountAuditPage'
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
        <Route path="/account-audit" element={<AccountAuditPage />} />
        <Route path="/backtests" element={<BacktestsPage />} />
        <Route path="/forward-gate" element={<ForwardGatePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
