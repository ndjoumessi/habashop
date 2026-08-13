import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDescription } from '@/pages/Activity'

/**
 * VERROU — le journal d'audit MONTRE ce qu'il a enregistré, et ne promet rien de faux.
 *
 * Deux défauts mesurés le 2026-08-13, sur le même écran :
 *  (a) `PATCH /api/tenant` stocke `{ currency: { avant, apres }, … }` — et l'écran
 *      jetait ce détail, faute d'y chercher la bonne forme. Cinq lignes « Tenant Locale
 *      Change » rigoureusement indistinguables, alors que la base savait tout.
 *  (b) le KPI « Total événements » affichait `items.length` d'une route plafonnée à 100,
 *      sous un sous-titre annonçant une traçabilité « complète ».
 *
 * ⚠️ (b) était INVISIBLE : le tenant de démonstration compte dix événements. Comme le
 * camembert calé sur six catégories, une démonstration sous le seuil ne démontre rien.
 */

const ACTIVITY = readFileSync(join(__dirname, '..', 'pages', 'Activity.tsx'), 'utf8')

describe('(a) le changement avant→après est RENDU', () => {
  it('un changement de locale devient lisible', () => {
    const brut = JSON.stringify({
      currency: { avant: 'XOF', apres: 'XAF' },
      vatRate: { avant: 18, apres: 19.25 },
    })
    const rendu = parseDescription(brut, 'TENANT_LOCALE_CHANGE')
    expect(rendu).toContain('currency XOF → XAF')
    expect(rendu).toContain('vatRate 18 → 19.25')
  })

  it('⚠️ une valeur ABSENTE se dit « — », jamais par un vide', () => {
    // « country  → CM » se lirait comme un bogue d'affichage, alors que c'est un champ
    // qui n'existait pas encore. L'absence se DIT — même famille que `ratingSummary`.
    const rendu = parseDescription(JSON.stringify({ country: { avant: null, apres: 'CM' } }), 'X')
    expect(rendu).toBe('country — → CM')
  })

  it('les formes CONNUES restent servies — la règle n’a rien perdu au passage', () => {
    expect(parseDescription(JSON.stringify({ name: 'Awa' }), 'DELETE_USER')).toBe('Awa')
    expect(parseDescription(JSON.stringify({ email: 'a@b.c' }), 'X')).toBe('a@b.c')
    expect(parseDescription('texte libre', 'X')).toBe('texte libre')
    expect(parseDescription('DELETE_USER', 'DELETE_USER')).toBe('')   // pas de doublon
    expect(parseDescription(undefined, 'X')).toBe('')
    expect(parseDescription('{cassé', 'X')).toBe('')                  // JSON invalide
  })

  it('⚠️ un JSON quelconque n’est PAS déversé à l’écran', () => {
    // Déverser l'objet entier ferait entrer tout ce qu'un futur appelant y mettrait,
    // données personnelles comprises — l'inverse de la règle qui limite cet audit à des
    // codes et des nombres. Seules DEUX formes sont rendues.
    expect(parseDescription(JSON.stringify({ secret: 'x', phone: '+237600000000' }), 'X')).toBe('')
  })
})

describe('(b) le total est celui du SERVEUR, et la troncature se dit', () => {
  it('l’écran ne dérive plus le total des lignes reçues', () => {
    // ⚠️ Règle de FORME : `activityLog.length` sous l'étiquette « total » est
    // exactement le défaut corrigé. Il reste légitime AILLEURS (le compte de lignes
    // affichées), d'où une recherche sur la ligne du KPI, pas sur le fichier.
    const ligneKpi = ACTIVITY.split('\n').find(l => l.includes("t('activity_total')")) ?? ''
    expect(ligneKpi, 'le KPI total doit exister').not.toBe('')
    expect(ligneKpi).toContain('totalServeur')
    expect(ligneKpi).not.toContain('activityLog.length')
  })

  it('⚠️ un total INCONNU ne s’invente pas — « … », jamais 0', () => {
    // `?? 0` afficherait « 0 événement » sur un journal qui n'a pas encore répondu :
    // un chiffre faux se retient, un tiret se lit.
    const ligneKpi = ACTIVITY.split('\n').find(l => l.includes("t('activity_total')")) ?? ''
    expect(/totalServeur\s*\?\?\s*0/.test(ligneKpi)).toBe(false)
  })

  it('la promesse de traçabilité « complète » a disparu', () => {
    // Elle était fausse deux fois : la route plafonne, et toutes les actions n'écrivent
    // pas d'audit. Une promesse d'exhaustivité fait cesser de chercher ailleurs.
    for (const promesse of ['Traçabilité complète', 'Complete audit trail']) {
      expect(ACTIVITY.includes(promesse)).toBe(false)
    }
  })

  it('⚠️ un ÉCHEC de lecture n’est pas rendu comme un journal VIDE', () => {
    // La route REMONTE volontairement son erreur (« un journal d'audit muet est pire
    // qu'un journal indisponible, parce qu'on le croit ») — et l'écran l'avalait dans
    // un `.catch(() => {})`, donc l'affichait comme « il ne s'est rien passé ».
    // Le garde serveur faisait son travail, l'affichage le défaisait.
    expect(/\.catch\(\(\) => \{\}\)/.test(ACTIVITY), 'plus aucun catch muet').toBe(false)
    expect(ACTIVITY).toContain('setEchec(true)')
    expect(ACTIVITY).toContain('if (echec) return')
  })

  it('le plafond n’est PAS recopié dans l’écran — il vit dans la route', () => {
    // Un « 100 » réécrit ici se périmerait au premier changement côté serveur, et la
    // divergence serait muette. La troncature se déduit de la comparaison au total.
    expect(/tronque\s*=\s*totalServeur !== null && totalServeur > activityLog\.length/.test(ACTIVITY)).toBe(true)
  })
})
