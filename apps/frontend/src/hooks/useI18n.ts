import { useAppStore } from '@/stores/appStore'

/**
 * Helper i18n partagé : renvoie une fonction `i(fr, en, es, it)`
 * qui sélectionne la chaîne selon la langue courante du store.
 * Remplace le helper `const i = (fr,en,es,it) => …` dupliqué dans les pages.
 */
export function useI18n() {
  const lang = useAppStore(s => s.lang)
  return (fr: string, en: string, es: string, it: string): string =>
    lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it
}
