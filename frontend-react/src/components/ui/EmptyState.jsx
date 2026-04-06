function EmptyState({ title = 'No data', description = 'No records available right now.' }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  )
}

export default EmptyState
