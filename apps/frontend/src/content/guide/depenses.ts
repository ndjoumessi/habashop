import type { GuideSection } from './types'

/**
 * DÉPENSES — appui CDC : `280` (Dépenses ✅).
 *
 * ⚠️ Dire que « Budget vs Réel » compare la MÊME période des deux côtés : c'est le défaut
 * qui a été corrigé (deux totaux d'une même grandeur sur deux POPULATIONS), et le manuel ne
 * doit pas laisser croire l'inverse.
 */
export const depenses: GuideSection = {
  id: 'depenses',
  titre: {
    fr: 'Suivre ses dépenses',
    en: 'Tracking expenses',
    es: 'Seguir los gastos',
    it: 'Seguire le spese',
  },
  intro: {
    fr: 'Les ventes seules ne disent pas si vous gagnez de l’argent. Enregistrer les dépenses — loyer, électricité, transport, emballages — permet de comparer ce qui entre et ce qui sort sur la même période.',
    en: 'Sales alone do not tell you whether you are making money. Recording expenses — rent, electricity, transport, packaging — lets you compare what comes in against what goes out over the same period.',
    es: 'Las ventas solas no dicen si gana dinero. Registrar los gastos —alquiler, electricidad, transporte, embalajes— permite comparar lo que entra con lo que sale en el mismo periodo.',
    it: 'Le vendite da sole non dicono se stai guadagnando. Registrare le spese — affitto, elettricità, trasporto, imballaggi — permette di confrontare ciò che entra con ciò che esce nello stesso periodo.',
  },
  etapes: [
    {
      titre: { fr: 'Enregistrer une dépense', en: 'Record an expense', es: 'Registrar un gasto', it: 'Registrare una spesa' },
      corps: {
        fr: 'Un libellé, une catégorie, un montant hors taxes et un taux : le montant toutes taxes en découle, vous n’avez pas à le saisir. Le mode de règlement est demandé, parce qu’une dépense en espèces et une dépense mobile ne se retrouvent pas au même endroit dans vos comptes.',
        en: 'A label, a category, a pre-tax amount and a rate: the tax-inclusive amount follows from those, you do not enter it. The payment method is asked for, because a cash expense and a mobile one do not land in the same place in your books.',
        es: 'Un concepto, una categoría, un importe sin impuestos y un tipo: el importe con impuestos se deduce, no hay que escribirlo. Se pide el medio de pago, porque un gasto en efectivo y uno móvil no acaban en el mismo sitio en sus cuentas.',
        it: 'Una voce, una categoria, un importo al netto e un’aliquota: l’importo lordo ne deriva, non devi inserirlo. Il metodo di pagamento viene richiesto, perché una spesa in contanti e una mobile non finiscono nello stesso posto nei tuoi conti.',
      },
    },
    {
      titre: { fr: 'Ranger par catégorie', en: 'Sort by category', es: 'Ordenar por categoría', it: 'Ordinare per categoria' },
      corps: {
        fr: 'La catégorie est ce qui rend les dépenses lisibles un mois plus tard. Tenez-vous-en à quelques catégories stables : dix catégories utilisées régulièrement valent mieux que quarante employées une fois chacune.',
        en: 'The category is what makes expenses readable a month later. Stick to a few stable categories: ten used regularly beat forty used once each.',
        es: 'La categoría es lo que hace legibles los gastos un mes después. Manténgase en unas pocas categorías estables: diez usadas con regularidad valen más que cuarenta usadas una vez cada una.',
        it: 'La categoria è ciò che rende leggibili le spese un mese dopo. Attieniti a poche categorie stabili: dieci usate regolarmente valgono più di quaranta usate una volta ciascuna.',
      },
    },
    {
      titre: { fr: 'Poser un budget par catégorie', en: 'Set a budget per category', es: 'Definir un presupuesto por categoría', it: 'Impostare un budget per categoria' },
      corps: {
        fr: 'Vous pouvez fixer un montant attendu par catégorie et par mois. L’écran compare alors le budget au réel — et les deux chiffres portent sur la MÊME période : si vous regardez le mois en cours, le budget affiché est celui du mois en cours, pas un cumul.',
        en: 'You can set an expected amount per category and per month. The screen then compares budget to actual — and both figures cover the SAME period: if you are looking at the current month, the budget shown is the current month’s, not a running total.',
        es: 'Puede fijar un importe previsto por categoría y por mes. La pantalla compara entonces presupuesto y real, y ambas cifras cubren el MISMO periodo: si mira el mes en curso, el presupuesto mostrado es el del mes en curso, no un acumulado.',
        it: 'Puoi fissare un importo previsto per categoria e per mese. La schermata confronta allora budget e consuntivo — e le due cifre coprono lo STESSO periodo: se guardi il mese corrente, il budget mostrato è quello del mese corrente, non un cumulato.',
      },
    },
  ],
}
