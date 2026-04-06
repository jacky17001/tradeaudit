function MetricCard({ label, value, tone = 'default' }) {
  const toneClass = tone === 'accent' ? 'text-cyan-300' : 'text-slate-100'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

export default MetricCard
