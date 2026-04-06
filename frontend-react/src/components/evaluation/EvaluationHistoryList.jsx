import DecisionBadge from './DecisionBadge'
import { useLanguage } from '../../i18n/LanguageContext'

function formatDate(value, language) {
  if (!value) {
    return '-'
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

function changeHint(current, previous, language, t) {
  if (!previous) {
    return t('evaluation.historyNoBaseline')
  }

  const delta = current.finalScore - previous.finalScore
  const scorePart =
    delta > 0
      ? t('evaluation.historyScoreUp', { delta: `+${delta}` })
      : delta < 0
        ? t('evaluation.historyScoreDown', { delta: `${delta}` })
        : t('evaluation.historyScoreFlat')

  const decisionPart =
    current.decision !== previous.decision
      ? t('evaluation.historyDecisionChanged', {
          previous: formatDecision(previous.decision, language, t),
          current: formatDecision(current.decision, language, t),
        })
      : t('evaluation.historyDecisionUnchanged')

  return `${scorePart}; ${decisionPart}`
}

function EvaluationHistoryList({ items = [], compact = false, title }) {
  const { language, t } = useLanguage()

  const normalized = Array.isArray(items) ? items.slice(0, 5) : []

  if (normalized.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          {title || t('evaluation.historyTitle')}
        </p>
        <p className="mt-2 text-sm text-slate-400">{t('evaluation.historyEmpty')}</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          {title || t('evaluation.historyTitle')}
        </p>
        <ul className="mt-2 space-y-2 text-xs">
          {normalized.map((item, index) => {
            const previous = normalized[index + 1] ?? null
            return (
              <li key={`${item.id}-${item.evaluatedAt}`} className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">{formatDate(item.evaluatedAt, language)}</span>
                  <span className="font-semibold text-cyan-300">{item.finalScore}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <DecisionBadge decision={item.decision} />
                  <span className="text-slate-500">{item.rulesVersion}</span>
                </div>
                <p className="mt-1 text-slate-400">{changeHint(item, previous, language, t)}</p>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
        {title || t('evaluation.historyTitle')}
      </p>
      <div className="mt-2 space-y-2">
        {normalized.map((item, index) => {
          const previous = normalized[index + 1] ?? null
          return (
            <div
              key={`${item.id}-${item.evaluatedAt}`}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{formatDate(item.evaluatedAt, language)}</span>
                <span className="text-sm font-semibold text-cyan-300">{t('evaluation.currentScore')}: {item.finalScore}</span>
                <DecisionBadge decision={item.decision} />
              </div>

              <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <p>{t('evaluation.rulesVersion')}: <span className="text-slate-300">{item.rulesVersion}</span></p>
                <p>{t('evaluation.datasetVersion')}: <span className="text-slate-300">{item.datasetVersion}</span></p>
              </div>

              <p className="mt-2 text-xs text-slate-400">{changeHint(item, previous, language, t)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default EvaluationHistoryList