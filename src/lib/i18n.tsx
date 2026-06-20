'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ★ Bilingual support — Bangla + English
// Language codes: 'en' (English, default) | 'bn' (Bangla)
export type Language = 'en' | 'bn'

interface LanguageContextValue {
  lang: Language
  setLang: (l: Language) => void
  toggle: () => void
  t: (en: string, bn: string) => string
  // Bangla input mode — when true, typing in input fields gets converted to Bangla
  banglaInput: boolean
  setBanglaInput: (v: boolean) => void
  toggleBanglaInput: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const LANG_STORAGE_KEY = 'dfcl-lang'
const BANGLA_INPUT_KEY = 'dfcl-bangla-input'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')
  const [banglaInput, setBanglaInputState] = useState<boolean>(false)
  const [mounted, setMounted] = useState(false)

  // Load saved language + bangla-input mode from localStorage on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY) as Language | null
      if (savedLang === 'en' || savedLang === 'bn') setLangState(savedLang)
      const savedInput = localStorage.getItem(BANGLA_INPUT_KEY)
      if (savedInput === 'true') setBanglaInputState(true)
    } catch {}
    setMounted(true)
  }, [])

  // Update <html lang="..."> whenever language changes (after mount to avoid SSR mismatch)
  useEffect(() => {
    if (!mounted) return
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
    }
  }, [lang, mounted])

  const setLang = useCallback((l: Language) => {
    setLangState(l)
    try { localStorage.setItem(LANG_STORAGE_KEY, l) } catch {}
  }, [])

  const toggle = useCallback(() => {
    setLangState(prev => {
      const next: Language = prev === 'en' ? 'bn' : 'en'
      try { localStorage.setItem(LANG_STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  const setBanglaInput = useCallback((v: boolean) => {
    setBanglaInputState(v)
    try { localStorage.setItem(BANGLA_INPUT_KEY, v ? 'true' : 'false') } catch {}
  }, [])

  const toggleBanglaInput = useCallback(() => {
    setBanglaInputState(prev => {
      const next = !prev
      try { localStorage.setItem(BANGLA_INPUT_KEY, next ? 'true' : 'false') } catch {}
      return next
    })
  }, [])

  // Translation function — caller passes both English and Bangla strings.
  // This avoids a giant lookup table and keeps translations co-located with usage.
  const t = useCallback((en: string, bn: string) => (lang === 'bn' ? bn : en), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t, banglaInput, setBanglaInput, toggleBanglaInput }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}

// Convenience hook — returns just the translation function
export function useT() {
  return useLanguage().t
}
