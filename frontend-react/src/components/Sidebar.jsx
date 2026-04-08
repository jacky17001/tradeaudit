import { Link, NavLink } from 'react-router-dom'
import { navItemsMock as navItems } from '../data/mock/navigation'
import { useLanguage } from '../i18n/LanguageContext'

const navLabelKeyByPath = {
  '/': 'sidebar.home',
  '/dashboard': 'sidebar.dashboard',
  '/result-overview': 'sidebar.resultOverview',
  '/audit-report': 'sidebar.auditReport',
  '/comparison-report': 'sidebar.comparisonReport',
  '/account-audit': 'sidebar.accountAudit',
  '/audit-cases': 'sidebar.auditCases',
  '/backtests': 'sidebar.backtests',
  '/forward-gate': 'sidebar.forwardGate',
}

function Sidebar({ isOpen = false, onClose }) {
  const { t } = useLanguage()

  const content = (
    <>
      <Link
        to="/"
        onClick={onClose}
        className="mb-8 block rounded-lg px-1 py-1 transition hover:bg-slate-900/50"
        aria-label="Go to home"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">TradeAudit</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">{t('sidebar.riskIntelligence')}</h1>
      </Link>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`
            }
          >
            {t(navLabelKeyByPath[item.path] || 'sidebar.home')}
          </NavLink>
        ))}
      </nav>
    </>
  )

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-800/70 bg-slate-950/70 p-5 md:block">
        {content}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-slate-950/65"
            onClick={onClose}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-slate-800/70 bg-slate-950 p-5 shadow-2xl shadow-slate-950/70">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  )
}

export default Sidebar
