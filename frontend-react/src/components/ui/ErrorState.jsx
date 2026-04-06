function ErrorState({ message = 'Failed to load data. Please try again.' }) {
  return (
    <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-6 text-sm text-rose-200">
      {message}
    </div>
  )
}

export default ErrorState
