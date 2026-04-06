import { NavLink } from 'react-router-dom'
import { navItemsMock as navItems } from '../data/mock/navigation'

function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/70 bg-slate-950/70 p-5">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">TradeAudit</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Risk Intelligence</h1>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
