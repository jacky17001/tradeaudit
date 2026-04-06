import { createContext, useContext, useMemo, useState } from 'react'
import { translations } from './translations'

const STORAGE_KEY = 'tradeaudit_lang'

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, vars) => key,
})

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  const browser = window.navigator.language.toLowerCase()
  return browser.startsWith('zh') ? 'zh' : 'en'
}

function resolveKey(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), obj)
}

function formatText(template, vars) {
  if (!vars) return template
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage)

  const setLanguage = (next) => {
    const safe = next === 'zh' ? 'zh' : 'en'
    setLanguageState(safe)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, safe)
    }
  }

  const t = (key, vars) => {
    const bundle = translations[language] || translations.en
    const fallbackBundle = translations.en
    const raw = resolveKey(bundle, key) ?? resolveKey(fallbackBundle, key) ?? key
    return typeof raw === 'string' ? formatText(raw, vars) : key
  }

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
