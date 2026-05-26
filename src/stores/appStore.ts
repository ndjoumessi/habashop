import { create } from 'zustand'

export type Lang = 'fr' | 'en' | 'es' | 'it'

interface AppState {
  lang: Lang; currency: string
  setLang: (l: Lang) => void
  setCurrency: (c: string) => void
  i: (fr: string, en: string, es: string, it: string) => string
}

export const useAppStore = create<AppState>((set, get) => ({
  lang: 'fr', currency: 'XOF',
  setLang: (lang) => set({ lang }),
  setCurrency: (currency) => set({ currency }),
  i: (fr, en, es, it) => {
    switch (get().lang) {
      case 'en': return en
      case 'es': return es
      case 'it': return it
      default:   return fr
    }
  },
}))
