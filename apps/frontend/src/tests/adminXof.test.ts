import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatInCurrency } from '@/stores/appStore'

// ⚠️ CONSOLE PLATEFORME — montants en XOF, jamais la devise du super-admin (dette froide).
//
// AdminDashboard affiche des montants PLATEFORME — prix des plans et CA, tarifés en XOF (Wave /
// Orange Money) — historiquement via useFormatAmount(), qui les CONVERTIT vers la devise
// d'affichage du super-admin connecté, avec des taux externes fluctuants. Un opérateur sur un
// tenant EUR voyait donc le CA plateforme en euros convertis, mentant sur le vrai chiffre en
// FCFA. Corrigé : formatInCurrency(_, 'XOF') — aucun montant de cette console n'est en
// devise-tenant, donc le convertisseur per-viewer n'a rien à y faire.
//
// Ce méta-test interdit le RETOUR de useFormatAmount dans ce fichier (scan du TEXTE source,
// commentaires compris) et ancre la propriété XOF = entier.

const ADMIN = join(__dirname, '..', 'pages', 'AdminDashboard.tsx')

describe('console plateforme — montants en XOF, pas la devise du super-admin', () => {
  it('AdminDashboard ne référence pas useFormatAmount (convertisseur per-viewer)', () => {
    const refs = readFileSync(ADMIN, 'utf-8')
      .split('\n')
      .map((l, i) => ({ l, i: i + 1 }))
      .filter(({ l }) => /useFormatAmount/.test(l))
      .map(({ i }) => `AdminDashboard.tsx:${i}`)
    expect(
      refs,
      `useFormatAmount convertit vers s.currency — la console plateforme est XOF. Utiliser formatInCurrency(_, 'XOF') :\n${refs.join('\n')}`,
    ).toEqual([])
  })

  it('formatInCurrency rend le XOF sans décimale (le FCFA est un entier)', () => {
    // Un basculement accidentel vers un format à 2 décimales serait faux pour le FCFA.
    const out = formatInCurrency(9900, 'XOF')
    // ⚠️ Séparateur de milliers MESURÉ, pas supposé : `Intl.NumberFormat('fr-FR')` rend
    // « 9 900 » avec une espace fine insécable **U+202F** — le même caractère qui produisait
    // « 8 /500 » sur les factures PDF (absent de WinAnsi). On l'écrit ÉCHAPPÉ : en littéral,
    // eslint `no-irregular-whitespace` casse le lint (une ERREUR, pas un avertissement).
    expect(out).toMatch(/9[\s\u202f]?900/)
    expect(out).not.toMatch(/[.,]\d\d(\D|$)/)   // aucun « ,00 » / « .00 »
  })
})
