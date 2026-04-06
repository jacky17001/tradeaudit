export type NavItem = {
  label: string
  path: string
}

export const navItemsMock: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Account Audit', path: '/account-audit' },
  { label: 'Backtests', path: '/backtests' },
  { label: 'Forward / Gate', path: '/forward-gate' },
]
