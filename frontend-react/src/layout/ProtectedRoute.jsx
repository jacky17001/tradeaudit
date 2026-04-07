import { useState, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import LoginPage from '../pages/LoginPage'
import { verifySession } from '../services/api/auth'

function mapAuthErrorToMessage(error, t) {
  const code = error?.details?.error?.code || ''
  if (code === 'SESSION_EXPIRED') {
    return t('login.sessionExpired')
  }
  if (code === 'INVALID_SESSION') {
    return t('login.invalidSession')
  }
  if (code === 'UNAUTHORIZED') {
    return `${t('login.accessDenied')}. ${t('login.pleaseReEnterPassword')}.`
  }
  return `${t('login.sessionExpired')} ${t('login.pleaseReEnterPassword')}`
}

function clearSessionStorage() {
  localStorage.removeItem('_tradeaudit_token')
  localStorage.removeItem('_tradeaudit_token_expires_at')
}

function ProtectedRoute({ children }) {
  const { t } = useLanguage()
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('_tradeaudit_token'))
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')

  // Verify token on mount
  useEffect(() => {
    if (!authToken) {
      setIsAuthenticating(false)
      setIsAuthenticated(false)
      return
    }

    const expiresAtRaw = localStorage.getItem('_tradeaudit_token_expires_at')
    if (expiresAtRaw) {
      const expiresAt = new Date(expiresAtRaw)
      if (!Number.isNaN(expiresAt.getTime()) && new Date() > expiresAt) {
        clearSessionStorage()
        setAuthToken(null)
        setIsAuthenticated(false)
        setAuthError(t('login.sessionExpired'))
        setIsAuthenticating(false)
        return
      }
    }

    const verify = async () => {
      try {
        await verifySession(authToken)
        setIsAuthenticated(true)
      } catch (error) {
        clearSessionStorage()
        setAuthToken(null)
        setIsAuthenticated(false)
        setAuthError(mapAuthErrorToMessage(error, t))
      } finally {
        setIsAuthenticating(false)
      }
    }

    verify()
  }, [authToken, t])

  const handleAuthSuccess = ({ token, expiresAt }) => {
    if (!token) {
      return
    }
    if (expiresAt) {
      localStorage.setItem('_tradeaudit_token_expires_at', expiresAt)
    }
    localStorage.setItem('_tradeaudit_token', token)
    setAuthToken(token)
    setIsAuthenticated(true)
    setAuthError('')
    setIsAuthenticating(false)
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
