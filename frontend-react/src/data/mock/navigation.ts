export type NavItem = {
  label: string
  path: string
}

export const navItemsMock: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Result Overview', path: '/result-overview' },
  { label: 'Account Audit', path: '/account-audit' },
  { label: 'Audit Cases', path: '/audit-cases' },
  { label: 'Backtests', path: '/backtests' },
  { label: 'Forward / Gate', path: '/forward-gate' },
]
