import { Navigate, useLocation } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const location = useLocation()
  const fakeToken = localStorage.getItem('tradeaudit_demo_token')
  const strictAuth = localStorage.getItem('tradeaudit_auth_mode') === 'strict'
  const isAuthenticated = strictAuth ? Boolean(fakeToken) : true

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
