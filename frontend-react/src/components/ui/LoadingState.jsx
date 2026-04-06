function LoadingState({ label = 'Loading data...' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span>{label}</span>
      </div>
    </div>
  )
}

export default LoadingState
