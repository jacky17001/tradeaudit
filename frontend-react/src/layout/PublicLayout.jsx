import { Outlet } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'

function PublicLayout() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="min-h-screen bg-transparent text-slate-200">
      <main className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
        <div className="mb-4 flex justify-end">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/80 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 transition sm:px-3 ${
                language === 'en' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {t('header.languageEN')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`border-l border-slate-700 px-2.5 py-1 transition sm:px-3 ${
                language === 'zh' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {t('header.languageZH')}
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}

export default PublicLayout
