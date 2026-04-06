function Button({ children, variant = 'primary', className = '', ...props }) {
  const variantClass =
    variant === 'secondary'
      ? 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'

  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
