import { useLanguage } from '../../i18n/LanguageContext'

function formatDate(value, language) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDelta(delta) {
  if (delta === null || delta === undefined) {
    return null
  }

  if (delta > 0) {
    return `+${delta}`
  }
  return String(delta)
}

function formatDecision(decision, language, t) {
  if (!decision) {
    return t('evaluation.notAvailable')
  }

  if (language !== 'zh') {
    return decision
  }

  if (decision === 'PASS') return t('evaluation.decisionPass')
  if (decision === 'FAIL') return t('evaluation.decisionFail')
  if (decision === 'NEEDS_IMPROVEMENT') return t('evaluation.decisionNeedsImprovement')
  return decision
}

function TraceCompareStrip({
  currentScore,
  evaluatedAt,
  rulesVersion,
  datasetVersion,
  previousScore,
  scoreDelta,
  previousDecision,
  decisionChanged,
  compact = false,
}) {
  const { language, t } = useLanguage()

  const scoreDeltaText = formatDelta(scoreDelta)
  const scoreDeltaTone =
    scoreDelta === null || scoreDelta === undefined
      ? 'text-slate-300'
      : scoreDelta > 0
        ? 'text-emerald-300'
        : scoreDelta < 0
          ? 'text-rose-300'
          : 'text-slate-300'

  const rows = [
    {
      key: 'currentScore',
      label: t('evaluation.currentScore'),
      value: currentScore ?? t('evaluation.notAvailable'),
      tone: 'text-cyan-200',
    },
    {
      key: 'evaluatedAt',
      label: t('evaluation.evaluatedAt'),
      value: formatDate(evaluatedAt, language) || t('evaluation.notAvailable'),
      tone: 'text-slate-200',
    },
    {
      key: 'rulesVersion',
      label: t('evaluation.rulesVersion'),
      value: rulesVersion || t('evaluation.notAvailable'),
      tone: 'text-slate-200',
    },
    {
      key: 'datasetVersion',
      label: t('evaluation.datasetVersion'),
      value: datasetVersion || t('evaluation.notAvailable'),
      tone: 'text-slate-200',
    },
    {
      key: 'previousScore',
      label: t('evaluation.previousScore'),
      value: previousScore ?? t('evaluation.notAvailable'),
      tone: 'text-slate-200',
    },
    {
      key: 'scoreDelta',
      label: t('evaluation.scoreDelta'),
      value: scoreDeltaText ?? t('evaluation.notAvailable'),
      tone: scoreDeltaTone,
    },
    {
      key: 'previousDecision',
      label: t('evaluation.previousDecision'),
      value: formatDecision(previousDecision, language, t),
      tone: 'text-slate-200',
    },
    {
      key: 'decisionChanged',
      label: t('evaluation.decisionChanged'),
      value:
        decisionChanged === null || decisionChanged === undefined
          ? t('evaluation.notAvailable')
          : decisionChanged
            ? t('evaluation.yes')
            : t('evaluation.no'),
      tone:
        decisionChanged === true
          ? 'text-amber-300'
          : decisionChanged === false
            ? 'text-slate-200'
            : 'text-slate-300',
    },
  ]

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <span
            key={row.key}
            className={`rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] ${row.tone}`}
          >
            <span className="text-slate-500">{row.label}:</span> {row.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('evaluation.traceAndCompare')}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-xs"
          >
            <span className="text-slate-500">{row.label}</span>
            <span className={`font-medium ${row.tone}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TraceCompareStrip