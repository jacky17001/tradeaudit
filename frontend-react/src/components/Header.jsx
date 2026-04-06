import { useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'

const pageTitleKeys = {
  '/': 'pageTitles.home',
  '/dashboard': 'pageTitles.dashboard',
  '/account-audit': 'pageTitles.accountAudit',
  '/backtests': 'pageTitles.backtests',
  '/forward-gate': 'pageTitles.forwardGate',
}

function Header({ onMenuToggle }) {
  const location = useLocation()
  const { language, setLanguage, t } = useLanguage()
  const title = t(pageTitleKeys[location.pathname] || 'pageTitles.home')

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-slate-950/80 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-200 md:hidden"
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
          >
            <span className="text-[10px] font-semibold tracking-wide">{t('header.menu')}</span>
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 sm:text-xs">{t('header.controlCenter')}</p>
            <h2 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h2>
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/80 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 transition sm:px-3 ${
              language === 'en' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            {t('header.languageEN')}
          </button>
          <button
            type="button"
            onClick={() => setLanguage('zh')}
            className={`border-l border-slate-700 px-2.5 py-1 transition sm:px-3 ${
              language === 'zh' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            {t('header.languageZH')}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
