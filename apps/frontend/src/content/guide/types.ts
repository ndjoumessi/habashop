/**
 * MANUEL D'UTILISATION — types du contenu.
 *
 * ⚠️ `id` n'est JAMAIS traduit : c'est l'ancre de l'URL. Un identifiant traduit casserait
 * tout lien partagé au premier changement de langue du lecteur.
 *
 * ⚠️ Les QUATRE langues sont exigées par le TYPE, pas par une convention :
 * `Record<GuideLang, string>` fait rougir `tsc` s'il en manque une. C'est le compilateur qui
 * garde la règle, pas la vigilance du rédacteur — le test, lui, ne couvre que la chaîne vide.
 *
 * ⚠️ RÈGLE DE CONTENU : le manuel ne documente QUE les capacités ✅ de
 * `docs/HabaShop_CDC_v4.md`. Décrire une capacité ⚠️ inerte, 🧪 en bac à sable ou ⬜ absente
 * est exactement ce que la vitrine a déjà payé (« Déployé dans 150+ pays », badges SSL/TLS,
 * retirés parce que faux). Un manuel est plus crédible qu'une vitrine : une fausseté y coûte
 * plus cher. Le verrou `guideClaims.test.ts` le vérifie, en DÉRIVANT du CDC.
 */
export type GuideLang = 'fr' | 'en' | 'es' | 'it'

/** Une chaîne dans les quatre langues. Aucune n'est optionnelle. */
export type Traduit = Record<GuideLang, string>

export interface GuideEtape {
  titre: Traduit
  corps: Traduit
}

export interface GuideSection {
  /** Ancre d'URL — slug stable, non traduit, unique. */
  id: string
  titre: Traduit
  intro: Traduit
  etapes: GuideEtape[]
}
