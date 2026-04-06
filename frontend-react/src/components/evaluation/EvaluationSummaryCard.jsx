import DecisionBadge from './DecisionBadge'
import ReasonList from './ReasonList'
import RecommendedActionList from './RecommendedActionList'
import ScoreBreakdownCard from './ScoreBreakdownCard'
import TrustMetaStrip from './TrustMetaStrip'
import TraceCompareStrip from './TraceCompareStrip'
import EvaluationHistoryList from './EvaluationHistoryList'
import { useLanguage } from '../../i18n/LanguageContext'

function toList(value) {
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

function EvaluationSummaryCard({
  finalScore,
  scoreBreakdown,
  decision,
  decisionReason,
  recommendedAction,
  explanation,
  breakdownLabels,
  hardFailTriggered = false,
  hardFailReasons = [],
  strongestFactor,
  weakestFactor,
  confidenceLevel = 'MEDIUM',
  sampleAdequacy = 'UNKNOWN',
  dataSourceType,
  evaluatedAt,
  rulesVersion,
  datasetVersion,
  previousScore,
  scoreDelta,
  previousDecision,
  decisionChanged,
  historyItems = [],
  compact = false,
}) {
  const { t } = useLanguage()
  const hardFailItems = toList(hardFailReasons)

  const hardFailBlock = hardFailTriggered ? (
    <div className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-rose-300">{t('evaluation.hardFailTriggered')}</p>
      <ul className="mt-2 space-y-1.5 text-sm text-rose-200">
        {(hardFailItems.length ? hardFailItems : [t('evaluation.notAvailable')]).map((reason, index) => (
          <li key={`${reason}-${index}`} className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t('evaluation.decision')}</p>
          <DecisionBadge decision={decision} />
        </div>
        {hardFailBlock}
        <TrustMetaStrip
          compact
          confidenceLevel={confidenceLevel}
          sampleAdequacy={sampleAdequacy}
          dataSourceType={dataSourceType}
          strongestFactor={strongestFactor}
          weakestFactor={weakestFactor}
          labels={breakdownLabels}
        />
        <TraceCompareStrip
          compact
          currentScore={finalScore}
          evaluatedAt={evaluatedAt}
          rulesVersion={rulesVersion}
          datasetVersion={datasetVersion}
          previousScore={previousScore}
          scoreDelta={scoreDelta}
          previousDecision={previousDecision}
          decisionChanged={decisionChanged}
        />
        <EvaluationHistoryList compact items={historyItems} />
        <div className="grid gap-3 lg:grid-cols-2">
          <ReasonList reasons={decisionReason} />
          <RecommendedActionList actions={recommendedAction} />
        </div>
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('evaluation.explanation')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{explanation || t('evaluation.notAvailable')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <ScoreBreakdownCard
        finalScore={finalScore}
        breakdown={scoreBreakdown}
        labels={breakdownLabels}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{t('evaluation.decision')}</p>
          <DecisionBadge decision={decision} />
        </div>

        <div className="space-y-4">
          {hardFailBlock}
          <TrustMetaStrip
            confidenceLevel={confidenceLevel}
            sampleAdequacy={sampleAdequacy}
            dataSourceType={dataSourceType}
            strongestFactor={strongestFactor}
            weakestFactor={weakestFactor}
            labels={breakdownLabels}
          />
          <TraceCompareStrip
            currentScore={finalScore}
            evaluatedAt={evaluatedAt}
            rulesVersion={rulesVersion}
            datasetVersion={datasetVersion}
            previousScore={previousScore}
            scoreDelta={scoreDelta}
            previousDecision={previousDecision}
            decisionChanged={decisionChanged}
          />
          <EvaluationHistoryList items={historyItems} />
          <ReasonList reasons={decisionReason} />
          <RecommendedActionList actions={recommendedAction} />
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t('evaluation.explanation')}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{explanation || t('evaluation.notAvailable')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EvaluationSummaryCard