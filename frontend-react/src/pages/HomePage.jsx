import { Link } from 'react-router-dom'
import SectionCard from '../components/SectionCard'
import Button from '../components/ui/Button'

function HomePage() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="TradeAudit"
        subtitle="Audit-first operating layer for strategy risk control and gate readiness"
      >
        <p className="max-w-3xl text-sm leading-7 text-slate-300">
          TradeAudit helps teams evaluate strategy quality, monitor account behavior, and ship
          forward-ready systems with confidence. This v1 frontend is structured for rapid expansion.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/dashboard">
            <Button>Open Dashboard</Button>
          </Link>
          <Link to="/account-audit">
            <Button variant="secondary">Investor Account Audit</Button>
          </Link>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Backtests" subtitle="Historical performance consistency">
          <p className="text-sm text-slate-300">Compare returns, drawdown profile, and robustness.</p>
        </SectionCard>
        <SectionCard title="Forward Validation" subtitle="Live behavior under market pressure">
          <p className="text-sm text-slate-300">Track forward stability and detect regime drift early.</p>
        </SectionCard>
        <SectionCard title="Gate Decisions" subtitle="Promotion readiness summary">
          <p className="text-sm text-slate-300">Convert metrics and behavior signals into clear actions.</p>
        </SectionCard>
      </div>
    </div>
  )
}

export default HomePage
