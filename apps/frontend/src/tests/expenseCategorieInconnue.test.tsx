import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExpensesJournal from '@/components/expenses/ExpensesJournal'
import { styleCategorie, CatPill, CATEGORY_STYLE } from '@/components/expenses/expensesShared'

/**
 * UNE CATÉGORIE DE DÉPENSE INCONNUE NE DOIT PAS FAIRE TOMBER L'ÉCRAN.
 *
 * ⚠️ CRASH RÉEL EN PRODUCTION le 2026-10-01 : « TypeError: Cannot read properties of
 * undefined (reading 'color') » dans `ExpensesJournal`, l'écran Dépenses entier remplacé
 * par la frontière d'erreur. Cause : `CATEGORY_STYLE[e.category]` sur une valeur absente de
 * la table — ici « Charges », écrite par le jeu de démonstration.
 *
 * ⚠️ MAIS LA FRAGILITÉ N'EST PAS DANS LE JEU. `Expense.category` est une colonne `String`
 * SANS enum, et le schéma zod du serveur la laisse libre (`z.string().optional()`) : toute
 * valeur venue d'un import, d'une version antérieure ou d'un appel direct à l'API fait
 * tomber la page du commerçant. Indexer un `Record` figé avec une donnée libre est un
 * `undefined` qui attend son tour.
 *
 * Règle du dépôt : *une valeur inconnue reste NEUTRE et VISIBLE* — jamais un crash, et
 * jamais assimilée à une catégorie réelle. « Autre » EXISTE dans le domaine : y ranger
 * l'inconnu confondrait deux choses différentes, comme le `?? 'cash'` des modes de paiement.
 */

describe('styleCategorie', () => {
  it('rend le style de la catégorie quand elle est connue', () => {
    expect(styleCategorie('Loyer')).toBe(CATEGORY_STYLE.Loyer)
  })

  it('⚠️ DÉCISIF : une catégorie inconnue rend un style NEUTRE, jamais `undefined`', () => {
    const s = styleCategorie('Charges')
    expect(s, 'c’est ce `undefined` qui a fait tomber l’écran').toBeDefined()
    expect(typeof s.color).toBe('string')
    expect(typeof s.bg).toBe('string')
  })

  it('⚠️ et l’inconnu n’est PAS rangé sous « Autre », qui est une catégorie RÉELLE', () => {
    expect(styleCategorie('Charges')).not.toBe(CATEGORY_STYLE.Autre)
  })

  it('une valeur vide ou absente est traitée comme inconnue, sans lever', () => {
    expect(() => styleCategorie('')).not.toThrow()
    expect(() => styleCategorie(undefined as unknown as string)).not.toThrow()
  })
})

describe('les surfaces qui affichent une catégorie', () => {
  const depense = {
    id: 1, label: 'Loyer boutique', category: 'Charges', amount: 150000, amountHT: 150000,
    vat: 18, date: '2026-10-01', mode: 'Espèces', status: 'Payé', recurrent: false,
  }
  const noop = () => undefined

  it('⚠️ le JOURNAL se rend sans lever sur une catégorie inconnue', () => {
    expect(() => render(
      <ExpensesJournal
        loading={false} expenses={[depense] as never} filtered={[depense] as never}
        search="" setSearch={noop} catFilter="Toutes" setCatFilter={noop}
        statFilter="Tous" setStatFilter={noop}
        onAdd={noop} onAccountingExport={noop} onPrintPDF={noop} onCSVExport={noop}
        onMarkPaid={noop} onDelete={noop} onEdit={noop}
      />,
    )).not.toThrow()
    // ⚠️ Et la valeur reste LISIBLE : on ne la masque pas, le commerçant doit la voir
    // pour pouvoir la corriger.
    expect(screen.getAllByText(/Charges/).length).toBeGreaterThan(0)
  })

  it('⚠️ la pastille se rend aussi — c’est la deuxième surface qui indexait la table', () => {
    expect(() => render(<CatPill cat={'Charges' as never} lang="fr" />)).not.toThrow()
  })
})
