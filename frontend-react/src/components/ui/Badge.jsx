function Badge({ children, tone = 'default' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-700/70 bg-emerald-900/30 text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-700/70 bg-amber-900/30 text-amber-200'
        : tone === 'danger'
          ? 'border-rose-700/70 bg-rose-900/30 text-rose-200'
          : tone === 'accent'
            ? 'border-cyan-700/70 bg-cyan-900/30 text-cyan-200'
            : 'border-slate-700/80 bg-slate-900/80 text-slate-300'

  return <span className={`rounded-full border px-2 py-1 text-xs ${toneClass}`}>{children}</span>
}

export default Badge
