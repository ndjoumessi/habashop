import type { GuideSection } from './types'
import { caisse } from './caisse'
import { stock } from './stock'
import { codesBarres } from './codesBarres'
import { clients } from './clients'
import { depenses } from './depenses'
import { rapports } from './rapports'
import { utilisateurs } from './utilisateurs'

/**
 * ORDRE DU MANUEL — source unique. Le sommaire ET les sections en dérivent tous les deux :
 * deux listes divergeraient, et c'est le sommaire qui mentirait.
 */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  caisse, stock, codesBarres, clients, depenses, rapports, utilisateurs,
]

export type { GuideSection, GuideLang, Traduit } from './types'
