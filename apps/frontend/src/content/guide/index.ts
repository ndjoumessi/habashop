import type { GuideSection } from './types'
import { caisse } from './caisse'

/**
 * ORDRE DU MANUEL — source unique. Le sommaire ET les sections en dérivent tous les deux :
 * deux listes divergeraient, et c'est le sommaire qui mentirait.
 */
export const GUIDE_SECTIONS: readonly GuideSection[] = [caisse]

export type { GuideSection, GuideLang, Traduit } from './types'
