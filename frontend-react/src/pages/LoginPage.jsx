import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import Button from '../components/ui/Button'
import { getConfigStatus, loginWithPassword } from '../services/api/auth'

export default function LoginPage({ onAuthSuccess, initialError = '' }) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [configWarning, setConfigWarning] = useState('')

  useEffect(() => {
    if (initialError) {
      setError(initialError)
    }
  }, [initialError])

  useEffect(() => {
    let isMounted = true

    const loadConfigStatus = async () => {
      try {
        const status = await getConfigStatus()
        if (!isMounted || !status?.configurationWarning) return

        const warnings = []
        if (!status.adminPasswordConfigured) {
          warnings.push(t('login.adminPasswordNotConfigured'))
        }
        if (status.unsafeAdminPassword) {
          warnings.push(t('login.unsafeAdminPassword'))
        }
        setConfigWarning(warnings.join(' · '))
      } catch {
        // Keep login page resilient even if config status endpoint is unavailable.
      }
    }

    loadConfigStatus()
    return () => {
      isMounted = false
    }
  }, [t])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const session = await loginWithPassword(password)
      onAuthSuccess({ token: session.token, expiresAt: session.expiresAt })
    } catch (err) {
      const code = err?.details?.error?.code || ''
      if (code === 'UNAUTHORIZED') {
        setError(t('login.invalidPassword'))
      } else {
        setError(err?.details?.error?.message || err?.message || t('login.invalidPassword'))
      }
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
            <p className="text-sm text-slate-400">{t('login.protectedAccessRequired')}</p>
          </div>

          {configWarning && (
            <div className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-100">
              <p className="font-semibold">{t('login.configurationWarning')}</p>
              <p className="mt-1">{configWarning}</p>
            </div>
          )}

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
