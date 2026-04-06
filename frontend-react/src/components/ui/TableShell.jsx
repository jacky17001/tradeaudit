import { useLanguage } from '../../i18n/LanguageContext'

function TableShell({
  title,
  subtitle,
  children,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
}) {
  const { t } = useLanguage()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrevious = page > 1
  const canNext = page < totalPages

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div>{children}</div>
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>{t('table.pageInfo', { page, totalPages, total })}</p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(page - 1)}
            disabled={!canPrevious}
            className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('table.previous')}
          </button>
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(page + 1)}
            disabled={!canNext}
            className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('table.next')}
          </button>
        </div>
      </div>
    </section>
  )
}

export default TableShell
