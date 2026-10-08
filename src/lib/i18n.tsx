// SPDX-License-Identifier: Apache-2.0
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'ar' | 'en'

const STORAGE_KEY = 'ib-lang'

interface I18nValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  isRTL: boolean
  setLang: (lang: Lang) => void
  toggle: () => void
  /** Inline translation: pick('عربي', 'English') */
  pick: <T>(ar: T, en: T) => T
}

const I18nContext = createContext<I18nValue | null>(null)

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ar' || saved === 'en') return saved
  } catch {
    /* private mode — fall through to the default */
  }
  // Arabic is the brand default; the switcher is always visible.
  return 'ar'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readInitialLang)

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const toggle = useCallback(() => setLang((current) => (current === 'ar' ? 'en' : 'ar')), [])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isRTL: lang === 'ar',
      setLang,
      toggle,
      pick: <T,>(ar: T, en: T) => (lang === 'ar' ? ar : en),
    }),
    [lang, toggle],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/* ------------------------------------------------------------- restaurant */

/** International format without "+" — wa.me requires this shape. */
export const WHATSAPP_NUMBER = '966579332227'
export const WHATSAPP_DISPLAY = '+966 57 933 2227'

export const MAPS_URL = 'https://maps.app.goo.gl/bSbbJE3dEfjpRJBa9'

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
