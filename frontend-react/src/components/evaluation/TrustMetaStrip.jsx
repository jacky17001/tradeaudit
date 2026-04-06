import { useLanguage } from '../../i18n/LanguageContext'

function mapConfidence(level, t) {
  if (level === 'HIGH') return t('evaluation.confidenceHigh')
  if (level === 'LOW') return t('evaluation.confidenceLow')
  return t('evaluation.confidenceMedium')
}

function mapAdequacy(level, t) {
  if (level === 'HIGH') return t('evaluation.adequacyHigh')
  if (level === 'LOW') return t('evaluation.adequacyLow')
  if (level === 'UNKNOWN') return t('evaluation.adequacyUnknown')
  return t('evaluation.adequacyMedium')
}

function formatFactorLabel(factor, labels, t) {
  if (!factor) {
    return t('evaluation.notAvailable')
  }

  return labels?.[factor] ?? factor
}

function TrustMetaStrip({
  confidenceLevel,
  sampleAdequacy,
  dataSourceType,
  strongestFactor,
  weakestFactor,
  labels,
  compact = false,
}) {
  const { t } = useLanguage()

  const rows = [
    {
      key: 'confidence',
      label: t('evaluation.confidenceLevel'),
      value: mapConfidence(confidenceLevel, t),
    },
    {
      key: 'adequacy',
      label: t('evaluation.sampleAdequacy'),
      value: mapAdequacy(sampleAdequacy, t),
    },
    {
      key: 'source',
      label: t('evaluation.dataSource'),
      value: dataSourceType || t('evaluation.notAvailable'),
    },
    {
      key: 'strongest',
      label: t('evaluation.strongestFactor'),
      value: formatFactorLabel(strongestFactor, labels, t),
    },
    {
      key: 'weakest',
      label: t('evaluation.weakestFactor'),
      value: formatFactorLabel(weakestFactor, labels, t),
    },
  ]

  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <span
            key={row.key}
            className="rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300"
          >
            <span className="text-slate-500">{row.label}:</span> {row.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('evaluation.trustSignals')}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-xs"
          >
            <span className="text-slate-500">{row.label}</span>
            <span className="font-medium text-slate-200">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustMetaStrip