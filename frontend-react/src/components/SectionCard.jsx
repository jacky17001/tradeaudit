function SectionCard({ title, subtitle, children, actions }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export default SectionCard
