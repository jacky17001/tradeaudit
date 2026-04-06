import { Outlet } from 'react-router-dom'

function PublicLayout() {
  return (
    <div className="min-h-screen bg-transparent text-slate-200">
      <main className="mx-auto max-w-7xl p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}

export default PublicLayout
