export type NavItem = {
  label: string
  path: string
}

export const navItemsMock: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Result Overview', path: '/result-overview' },
  { label: 'Portfolio View', path: '/portfolio' },
  { label: 'Follow-up Tasks', path: '/follow-up-tasks' },
  { label: 'Snapshot History', path: '/report-snapshots' },
  { label: 'Audit Report', path: '/audit-report' },
  { label: 'Comparison Report', path: '/comparison-report' },
  { label: 'Account Audit', path: '/account-audit' },
  { label: 'Audit Cases', path: '/audit-cases' },
  { label: 'Backtests', path: '/backtests' },
  { label: 'Forward / Gate', path: '/forward-gate' },
]
