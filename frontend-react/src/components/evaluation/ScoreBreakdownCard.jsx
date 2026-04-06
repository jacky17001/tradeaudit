import { useLanguage } from '../../i18n/LanguageContext'

function ScoreBreakdownCard({ finalScore, breakdown, labels = {}, compact = false }) {
  const { t } = useLanguage()

  const entries = Object.entries(breakdown ?? {})

  if (compact) {
    return (
      <div className="space-y-1">
        <p className="text-right text-sm font-semibold text-cyan-300">{finalScore}</p>
        <div className="flex flex-wrap justify-end gap-1">
          {entries.map(([key, value]) => (
            <span
              key={key}
              className="rounded border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
              title={labels[key] ?? key}
            >
              {(labels[key] ?? key).slice(0, 8)}:{value}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t('evaluation.finalScore')}</p>
      <p className="mt-2 text-2xl font-semibold text-cyan-300">{finalScore}</p>

      <div className="mt-3 space-y-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm"
          >
            <span className="text-slate-400">{labels[key] ?? key}</span>
            <span className="font-medium text-slate-100">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ScoreBreakdownCard