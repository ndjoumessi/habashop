import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POS_PAY_MODES, VALID_POS_PAY_MODES, resolvePosPayMode } from '@/stores/appStore'

/**
 * VERROU — le mode de paiement par défaut du POS appartient au domaine des TUILES RÉELLES.
 *
 * ─── CE QUI A ÉTÉ MESURÉ (2026-08-06) ────────────────────────────────────────
 * `posDefaultPayment` était typé `'cash' | 'card' | 'mobile'` et `POS.tsx` le castait vers
 * `'cash'|'card'|'wave'|'orange'|'mtn'`. Le cast mentait DANS LES DEUX SENS :
 *
 *   déclaré au type   cash · card · mobile
 *   offert à l'écran  cash · card · wave · orange · mobile   ← `Settings.tsx:646`, commit
 *                                                              1e519fca (2026-05-20 → 05-24)
 *   accepté par le POS cash · card · wave · orange · mtn
 *
 * Donc `wave` et `orange` s'écrivaient HORS du type déclaré, et `mobile` s'écrivait hors du
 * domaine du POS. Le `as` a rendu les deux écarts silencieux pendant trois mois.
 *
 * ⚠️ CE N'EST PAS THÉORIQUE : `appStore` est PERSISTÉ en localStorage (`partialize` conserve
 * ce champ dans `...rest`). Un commerçant ayant choisi « 📱 Mobile » pendant cette fenêtre a
 * toujours `'mobile'` dans son navigateur — et le POS pré-sélectionnait alors une tuile qui
 * n'existe pas. L'écran de réglages a disparu quatre jours plus tard : la valeur est devenue
 * inatteignable en écriture, mais elle n'a jamais été nettoyée en lecture.
 *
 * ─── LA DÉCISION PRODUIT, et pourquoi ────────────────────────────────────────
 * `'mobile'` retombe sur `'cash'`. Il n'est PAS résolu vers Wave, Orange ou MTN :
 *   • le commerçant a choisi « Mobile » quand l'application ne demandait pas lequel — en
 *     choisir un à sa place inventerait une décision qu'il n'a pas prise ;
 *   • le prestataire réellement disponible dépend de la configuration SERVEUR du tenant
 *     (clés Campay / MTN / PayDunya), pas de cet appareil ;
 *   • un repli neutre vaut mieux qu'un repli qui affirme — même raisonnement que le thème
 *     obsolète qui retombe sur « Sombre », et que `ratingSummary` qui rend `null` plutôt
 *     qu'une note inventée.
 *
 * ─── CE QUE CE VERROU NE COUVRE PAS ──────────────────────────────────────────
 * Il juge le domaine et le repli, pas le RENDU des tuiles : que `payMode` corresponde à une
 * tuile affichable est vérifié par les tests d'ancrage POS.
 */

const SRC = join(__dirname, '..')

describe('domaine des modes de paiement du POS', () => {
  it('le domaine déclaré est exactement celui des tuiles du POS', () => {
    // Périmètre DÉRIVÉ du code qui rend les tuiles, jamais une liste recopiée ici : une liste
    // écrite à la main se périme au premier prestataire ajouté, sans que rien ne le dise.
    const modals = readFileSync(join(SRC, 'components/pos/POSModals.tsx'), 'utf8')
    const rendus = new Set(
      [...modals.matchAll(/payMode\s*===\s*'([a-z_]+)'/g)].map(m => m[1]),
    )
    expect(rendus.size, 'aucune tuile trouvée — le scan ne garde rien').toBeGreaterThanOrEqual(5)
    expect([...rendus].sort()).toEqual([...POS_PAY_MODES].sort())
  })

  it('AUCUN cast ne rétrécit ni n’élargit ce domaine dans POS.tsx', () => {
    const src = readFileSync(join(SRC, 'pages/POS.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const casts = [...src.matchAll(/\bas\s+((?:'[^']+'|"[^"]+")(?:\s*\|\s*(?:'[^']+'|"[^"]+"))+)/g)]
      .map(m => m[1])
      .filter(u => /'cash'|'wave'|'orange'|'mtn'|'mobile'/.test(u))
    expect(casts, 'un `as` sur ce domaine masque exactement ce qu’on vient de découvrir').toEqual([])
  })

  it('« mobile » — la valeur RÉELLEMENT écrivable en mai 2026 — est écartée', () => {
    // ⚠️ Ce n'est pas une valeur inventée pour le test : `Settings.tsx:646` du commit 1e519fca
    // la proposait sous le libellé « 📱 Mobile ».
    expect(VALID_POS_PAY_MODES.has('mobile')).toBe(false)
    // …et les deux autres valeurs de ce même sélecteur, elles, sont légitimes aujourd'hui.
    expect(VALID_POS_PAY_MODES.has('wave')).toBe(true)
    expect(VALID_POS_PAY_MODES.has('orange')).toBe(true)
  })

  it('le repli est NEUTRE — jamais un prestataire choisi à la place du commerçant', () => {
    // ⚠️ On exerce la VRAIE fonction du store, pas une copie. Une première version rejouait
    // la règle à l'identique dans le test : le sabotage « `'mobile'` → `'wave'` » passait
    // alors au VERT, puisque le test ne touchait jamais le code de production. C'est la
    // signature du test qui prouve la SOURCE sans prouver l'APPLICATION.
    expect(resolvePosPayMode('mobile'), 'un prestataire choisi à la place du commerçant').toBe('cash')
    expect(resolvePosPayMode(undefined)).toBe('cash')
    expect(resolvePosPayMode('')).toBe('cash')
    expect(resolvePosPayMode('paydunya')).toBe('cash')   // un futur prestataire non déclaré
    expect(resolvePosPayMode({ mode: 'wave' })).toBe('cash')  // le localStorage peut rendre n'importe quoi
    // Un choix VALIDE n'est jamais écrasé.
    for (const m of POS_PAY_MODES) expect(resolvePosPayMode(m)).toBe(m)
  })

  it('le garde de réhydratation est bien POSÉ dans le store, pas seulement disponible', () => {
    // ⚠️ Un helper exporté que personne n'appelle ne protège rien — c'est la leçon du méta-test
    // qui prouvait la SOURCE sans prouver l'APPLICATION. On exige l'appel dans `merge`.
    const store = readFileSync(join(SRC, 'stores/appStore.ts'), 'utf8')
    const merge = /merge:\s*\(persisted[\s\S]{0,2000}?\n {6}\}/.exec(store)?.[0] ?? ''
    expect(merge, '`merge` est introuvable — le scan ne garde rien').toBeTruthy()
    expect(merge).toContain('resolvePosPayMode')
    expect(merge).toMatch(/posDefaultPayment:/)
  })

  it('ce domaine reste DISTINCT du catalogue de paiement des abonnements', () => {
    // ⚠️ `PaymentMethodId` (`lib/paymentMethods.ts`) énumère les moyens de payer un ABONNEMENT.
    // Les deux listes se ressemblent (`wave`, `card`…) et diffèrent (`orange_money` vs
    // `orange`, `virement`, `cash`). Les fondre ferait perdre ce que chacune distingue —
    // c'est le § « Refactor transverse : un goulot ne doit pas être un entonnoir ».
    const pm = readFileSync(join(SRC, 'lib/paymentMethods.ts'), 'utf8')
    const abo = new Set(
      (/export type PaymentMethodId =([^\n]+)/.exec(pm)?.[1] ?? '')
        .split('|').map(x => x.trim().replace(/'/g, '')).filter(Boolean),
    )
    expect(abo.size, 'catalogue d’abonnement introuvable').toBeGreaterThanOrEqual(4)
    expect(abo.has('cash'), 'on ne paie pas un abonnement en espèces').toBe(false)
    expect(abo.has('orange_money')).toBe(true)
    expect(VALID_POS_PAY_MODES.has('orange_money'), 'les deux domaines ne doivent pas fusionner').toBe(false)
  })
})
