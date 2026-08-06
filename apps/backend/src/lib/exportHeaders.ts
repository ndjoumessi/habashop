/**
 * EN-TÊTES DES EXPORTS CSV — Record exhaustif sur les quatre langues.
 *
 * ⚠️ Les cinq jeux d'en-têtes s'écrivaient `lang === 'fr' ? [FR] : [EN]`. Deux branches
 * pour un domaine de quatre : un commerçant réglé en **espagnol ou en italien** exportait
 * son stock, ses clients, ses fournisseurs, ses ventes et ses employés avec des en-têtes
 * **anglais**. C'est le seul des vingt-cinq ternaires mesurés qui sorte du produit et
 * arrive chez un comptable.
 *
 * ⚠️ Le repli est le FRANÇAIS, pas l'anglais : c'est la langue par défaut du produit
 * (`lang = query.lang ?? 'fr'`) et celle de la majorité des boutiques. Un `lang` inconnu
 * (paramètre de requête libre) retombe donc sur le français, pas sur une troisième langue.
 */

export type ExportLang = 'fr' | 'en' | 'es' | 'it'
export const EXPORT_LANGS: readonly ExportLang[] = ['fr', 'en', 'es', 'it'] as const

/** Ressources exportables. Ajouter une entrée ici oblige à écrire ses quatre en-têtes. */
export type ExportResource = 'products' | 'customers' | 'suppliers' | 'sales' | 'employees'

/**
 * ⚠️ `Record<ExportResource, Record<ExportLang, string[]>>` : `tsc` échoue si une
 * ressource ou une langue manque. C'est ce que le ternaire ne pouvait pas faire.
 */
const HEADERS: Record<ExportResource, Record<ExportLang, readonly string[]>> = {
  products: {
    fr: ['Nom', 'Catégorie', 'Stock', 'Min', 'Prix achat', 'Prix vente'],
    en: ['Name', 'Category', 'Stock', 'Min', 'Buy price', 'Sell price'],
    es: ['Nombre', 'Categoría', 'Stock', 'Mín', 'Precio compra', 'Precio venta'],
    it: ['Nome', 'Categoria', 'Giacenza', 'Min', 'Prezzo acquisto', 'Prezzo vendita'],
  },
  customers: {
    fr: ['Nom', 'Téléphone', 'Email', 'Type', 'CA Total', 'Points'],
    en: ['Name', 'Phone', 'Email', 'Type', 'Revenue', 'Points'],
    es: ['Nombre', 'Teléfono', 'Email', 'Tipo', 'Ingresos', 'Puntos'],
    it: ['Nome', 'Telefono', 'Email', 'Tipo', 'Fatturato', 'Punti'],
  },
  // ⚠️ « Catégorie », PAS « Spécialité » : c'est le champ réel (`Supplier.categories`) et
  // déjà le vocabulaire de l'export frontend. Deux exports du même objet annonçaient deux
  // noms pour la même donnée — corrigé en #170, à ne pas réintroduire en traduisant.
  suppliers: {
    fr: ['Nom', 'Catégorie', 'Téléphone', 'Email', 'Rating', 'Délai'],
    en: ['Name', 'Category', 'Phone', 'Email', 'Rating', 'Lead time'],
    es: ['Nombre', 'Categoría', 'Teléfono', 'Email', 'Valoración', 'Plazo'],
    it: ['Nome', 'Categoria', 'Telefono', 'Email', 'Valutazione', 'Tempi'],
  },
  sales: {
    fr: ['Date', 'Réf', 'Articles', 'Total', 'Paiement'],
    en: ['Date', 'Ref', 'Items', 'Total', 'Payment'],
    es: ['Fecha', 'Ref', 'Artículos', 'Total', 'Pago'],
    it: ['Data', 'Rif', 'Articoli', 'Totale', 'Pagamento'],
  },
  employees: {
    fr: ['Nom', 'Rôle', 'Département', 'Salaire', 'Type'],
    en: ['Name', 'Role', 'Department', 'Salary', 'Type'],
    es: ['Nombre', 'Rol', 'Departamento', 'Salario', 'Tipo'],
    it: ['Nome', 'Ruolo', 'Reparto', 'Stipendio', 'Tipo'],
  },
}

export function isExportLang(v: unknown): v is ExportLang {
  return typeof v === 'string' && (EXPORT_LANGS as readonly string[]).includes(v)
}

/** En-têtes d'une ressource. Un `lang` inconnu retombe sur le français. */
export function exportHeaders(resource: ExportResource, lang: string): string[] {
  return [...HEADERS[resource][isExportLang(lang) ? lang : 'fr']]
}
