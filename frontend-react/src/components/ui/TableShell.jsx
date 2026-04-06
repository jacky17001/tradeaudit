function TableShell({
  title,
  subtitle,
  children,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrevious = page > 1
  const canNext = page < totalPages

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div>{children}</div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
        <p>
          Page {page} of {totalPages} · {total} records
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(page - 1)}
            disabled={!canPrevious}
            className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(page + 1)}
            disabled={!canNext}
            className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default TableShell
