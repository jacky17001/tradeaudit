function formatTimelineDate(value, language) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sourceBadgeLabel(sourceSection, t) {
  if (sourceSection === 'backtests') return t('timeline.sourceBacktests')
  if (sourceSection === 'forward') return t('timeline.sourceForward')
  if (sourceSection === 'gate') return t('timeline.sourceGate')
  if (sourceSection === 'review') return t('timeline.sourceReview')
  return t('timeline.sourceAccountAudit')
}

function titleLabel(title, t) {
  const keyMap = {
    imported: 'timeline.eventImported',
    'candidate marked': 'timeline.eventCandidateMarked',
    'candidate removed': 'timeline.eventCandidateRemoved',
    'forward run created': 'timeline.eventForwardRunCreated',
    'forward status updated': 'timeline.eventForwardStatusUpdated',
    'summary updated': 'timeline.eventSummaryUpdated',
    'gate result saved': 'timeline.eventGateResultSaved',
    'intake created': 'timeline.eventIntakeCreated',
    'mt5 synced': 'timeline.eventMt5Synced',
    'review note added': 'timeline.eventReviewNoteAdded',
    'review action recorded': 'timeline.eventReviewActionRecorded',
  }
  return keyMap[title] ? t(keyMap[title]) : title
}

export default function ActivityTimeline({
  title,
  items,
  isLoading,
  t,
  language,
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{title || t('timeline.activityTimeline')}</p>

      {isLoading ? (
        <p className="mt-2 text-xs text-slate-500">{t('common.loading')}</p>
      ) : !items || items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{t('timeline.noEventsYet')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((event, index) => (
            <div key={`${event.event_type}-${event.created_at}-${index}`} className="rounded-md border border-slate-800/90 bg-slate-900/60 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-100">{titleLabel(event.title, t)}</p>
                <span className="rounded-full border border-slate-700/50 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-300">
                  {sourceBadgeLabel(event.source_section, t)}
                </span>
              </div>
              {event.description ? <p className="mt-1 text-xs text-slate-300">{event.description}</p> : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>{formatTimelineDate(event.created_at, language)}</span>
                {event.actor ? <span>· {event.actor}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
