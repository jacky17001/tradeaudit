import { useState, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import LoginPage from '../pages/LoginPage'

function ProtectedRoute({ children }) {
  const { t } = useLanguage()
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('_tradeaudit_token'))
  const [isAuthenticating, setIsAuthenticating] = useState(!!authToken)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')

  // Verify token on mount
  useEffect(() => {
    if (!authToken) {
      setIsAuthenticating(false)
      return
    }

    const expiresAtRaw = localStorage.getItem('_tradeaudit_token_expires_at')
    if (expiresAtRaw) {
      const expiresAt = new Date(expiresAtRaw)
      if (!Number.isNaN(expiresAt.getTime()) && new Date() > expiresAt) {
        localStorage.removeItem('_tradeaudit_token')
        localStorage.removeItem('_tradeaudit_token_expires_at')
        setAuthToken(null)
        setIsAuthenticated(false)
        setAuthError(t('login.sessionExpired'))
        setIsAuthenticating(false)
        return
      }
    }

    const verify = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) {
          throw new Error('invalid session')
        }
        setIsAuthenticated(true)
      } catch {
        localStorage.removeItem('_tradeaudit_token')
        localStorage.removeItem('_tradeaudit_token_expires_at')
        setAuthToken(null)
        setIsAuthenticated(false)
        setAuthError(t('login.sessionExpired'))
      } finally {
        setIsAuthenticating(false)
      }
    }

    verify()
  }, [authToken, t])

  const handleAuthSuccess = (token) => {
    setAuthToken(token)
    setIsAuthenticated(true)
    setAuthError('')
    localStorage.setItem('_tradeaudit_token', token)
  }

  if (!authToken) {
    return <LoginPage onAuthSuccess={handleAuthSuccess} initialError={authError} />
  }

  if (isAuthenticating) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950">Loading...</div>
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthSuccess={handleAuthSuccess} initialError={authError} />
  }

  return children
}

export default ProtectedRoute
