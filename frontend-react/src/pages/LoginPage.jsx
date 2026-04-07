import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { endpoints } from '../services/endpoints'
import Button from '../components/ui/Button'

export default function LoginPage({ onAuthSuccess, initialError = '' }) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialError) {
      setError(initialError)
    }
  }, [initialError])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(endpoints.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || t('login.invalidPassword'))
      }

      const data = await response.json()
      
      // Store token
      localStorage.setItem('_tradeaudit_token', data.token)
      localStorage.setItem('_tradeaudit_token_expires_at', data.expiresAt)

      // Callback
      onAuthSuccess(data.token)
    } catch (err) {
      setError(err.message || t('login.invalidPassword'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 shadow-2xl shadow-slate-950/60 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-100 mb-2">TradeAudit</h1>
            <p className="text-sm text-slate-400">{t('login.protectedAccess')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 mb-2">
                {t('login.enterPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600/20 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-xs text-rose-200">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !password.trim()}
              variant="primary"
              className="w-full"
            >
              {loading ? t('common.loading') : t('login.continue')}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            {t('login.devDefaultPassword')}
          </p>
        </div>
      </div>
    </div>
  )
}
