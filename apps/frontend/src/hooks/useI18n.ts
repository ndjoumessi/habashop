import { useAppStore } from '../stores/appStore'
import { useCallback } from 'react'

export type Lang = 'fr' | 'en' | 'es' | 'it'

/**
 * Hook d'internationalisation : `i(fr,en,es,it)` choisit la chaîne selon la langue
 * courante du store, plus `formatDate`/`formatDateTime` localisés (FR/EN/ES/IT).
 * @returns { lang, i, formatDate, formatDateTime }
 */
export function useI18n() {
  const lang = useAppStore(s => s.lang) as Lang

  const i = useCallback((fr: string, en: string, es: string, it: string): string => {
    switch(lang) {
      case 'en': return en
      case 'es': return es
      case 'it': return it
      default:   return fr
    }
  }, [lang])

  const formatDate = useCallback((date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
    const locale = { fr:'fr-FR', en:'en-US', es:'es-ES', it:'it-IT' }[lang] ?? 'fr-FR'
    return new Date(date).toLocaleDateString(locale, options ?? { day:'2-digit', month:'2-digit', year:'numeric' })
  }, [lang])

  const formatDateTime = useCallback((date: string | Date): string => {
    const locale = { fr:'fr-FR', en:'en-US', es:'es-ES', it:'it-IT' }[lang] ?? 'fr-FR'
    return new Date(date).toLocaleString(locale, { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }, [lang])

  return { lang, i, formatDate, formatDateTime }
}

export function useT() {
  const { i } = useI18n()
  return i
}
