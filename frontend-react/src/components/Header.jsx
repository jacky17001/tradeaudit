import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/account-audit': 'Account Audit',
  '/backtests': 'Backtests',
  '/forward-gate': 'Forward / Gate',
}

function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'TradeAudit'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Control Center</p>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-sm text-slate-300">
        EN | 中文
      </div>
    </header>
  )
}

export default Header
