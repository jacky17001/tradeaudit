import { useLanguage } from '../../i18n/LanguageContext'

function toActions(value) {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim())
  }

  const text = String(value).trim()
  if (!text) {
    return []
  }
  if (text.includes(';')) {
    return text
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return [text]
}

function RecommendedActionList({ actions, className = '' }) {
  const { t } = useLanguage()
  const items = toActions(actions)

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
        {t('evaluation.recommendedAction')}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{t('evaluation.notAvailable')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan-500/80" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default RecommendedActionList