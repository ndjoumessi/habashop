import { isThemeLight } from '@/stores/appStore'

// ─── Types partagés page ↔ modale ─────────────────────────────────────────────
export interface SubProduct { id: string; name: string; sellPrice: number; emoji: string; image?: string | null; stockQty: number }
export interface SubItem    { id: string; productId: string; quantity: number; product: SubProduct }
export interface SubCustomer{ id: string; name: string; phone?: string }
export interface Sub {
  id: string; name: string; dayOfWeek: number; status: string
  note?: string; customerId: string; createdAt: string
  /** Première livraison. `null`/absent = pas de date de début (comportement historique). */
  startDate?: string | null
  customer: SubCustomer
  items: SubItem[]
}

/** Ligne du panier en cours d'édition (avant enregistrement). */
export interface DraftItem { productId: string; quantity: number; product: SubProduct }

// ─── Constantes i18n ──────────────────────────────────────────────────────────
export const DAY_LABELS: Record<string, string[]> = {
  fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'],
}

export const DAY_SHORT: Record<string, string[]> = {
  fr: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  es: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  it: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
}

function i(fr: string, en: string, es: string, it: string) {
  return { fr, en, es, it }
}

export const T = {
  title:        i('Abonnements clients','Customer subscriptions','Suscripciones de clientes','Abbonamenti clienti'),
  subtitle:     i('Paniers hebdomadaires récurrents','Weekly recurring baskets','Cestas semanales recurrentes','Cesti settimanali ricorrenti'),
  new:          i('Nouvel abonnement','New subscription','Nueva suscripción','Nuovo abbonamento'),
  due_today:    i('Dus aujourd\'hui','Due today','Vencen hoy','In scadenza oggi'),
  all:          i('Tous les abonnements','All subscriptions','Todos los abonos','Tutti gli abbonamenti'),
  active:       i('Actif','Active','Activo','Attivo'),
  paused:       i('Pausé','Paused','Pausado','In pausa'),
  cancelled:    i('Annulé','Cancelled','Cancelado','Annullato'),
  load_cart:    i('Charger en caisse','Load to cart','Cargar al carrito','Carica al carrello'),
  edit:         i('Modifier','Edit','Editar','Modifica'),
  pause:        i('Mettre en pause','Pause','Pausar','Metti in pausa'),
  resume:       i('Reprendre','Resume','Reanudar','Riprendi'),
  delete:       i('Supprimer','Delete','Eliminar','Elimina'),
  confirm_del:  i('Supprimer cet abonnement ?','Delete this subscription?','¿Eliminar esta suscripción?','Eliminare questo abbonamento?'),
  empty:        i('Aucun abonnement actif','No active subscriptions','No hay suscripciones activas','Nessun abbonamento attivo'),
  empty_due:    i('Aucun abonnement dû aujourd\'hui','No subscriptions due today','Ninguna suscripción vence hoy','Nessun abbonamento in scadenza oggi'),
  name_label:   i('Nom du panier','Basket name','Nombre del cesto','Nome del cesto'),
  day_label:    i('Jour de livraison','Delivery day','Día de entrega','Giorno di consegna'),
  customer_label:i('Client','Customer','Cliente','Cliente'),
  note_label:   i('Note','Note','Nota','Nota'),
  products_label:i('Produits','Products','Productos','Prodotti'),
  qty_label:    i('Qté','Qty','Cant.','Qt.'),
  save:         i('Enregistrer','Save','Guardar','Salva'),
  cancel:       i('Annuler','Cancel','Cancelar','Annulla'),
  add_product:  i('Ajouter un produit','Add a product','Agregar producto','Aggiungi prodotto'),
  search_cust:  i('Rechercher un client…','Search customer…','Buscar cliente…','Cerca cliente…'),
  search_prod:  i('Rechercher un produit…','Search product…','Buscar producto…','Cerca prodotto…'),
  cart_loaded:  i('Panier chargé en caisse','Basket loaded to cart','Cesto cargado al carrito','Cesto caricato al carrello'),
  no_items:     i('Ce panier est vide','This basket is empty','Este cesto está vacío','Questo cesto è vuoto'),
  total:        i('Total estimé','Estimated total','Total estimado','Totale stimato'),
  saved:        i('Abonnement enregistré','Subscription saved','Suscripción guardada','Abbonamento salvato'),
  deleted:      i('Abonnement supprimé','Subscription deleted','Suscripción eliminada','Abbonamento eliminato'),
  status_upd:   i('Statut mis à jour','Status updated','Estado actualizado','Stato aggiornato'),
  go_pos:       i('Allez sur la caisse pour voir le panier','Go to POS to view the cart','Ve al POS para ver el carrito','Vai al POS per vedere il carrello'),

  // ── Modale redessinée ──
  modal_sub:    i('Panier récurrent livré chaque semaine','Recurring basket delivered every week','Cesta recurrente entregada cada semana','Cesto ricorrente consegnato ogni settimana'),
  cart_label:   i('Produits du panier','Basket products','Productos del cesto','Prodotti del cesto'),
  cart_search:  i('Rechercher un produit à ajouter…','Search a product to add…','Buscar un producto para agregar…','Cerca un prodotto da aggiungere…'),
  cart_empty:   i('Panier vide — ajoutez les articles','Empty basket — add the items','Cesto vacío — agrega los artículos','Cesto vuoto — aggiungi gli articoli'),
  cart_empty_s: i('Ce sont les produits livrés à chaque passage.','These are the products delivered on each round.','Estos son los productos entregados en cada pasada.','Sono i prodotti consegnati a ogni passaggio.'),
  per_unit:     i('l\'unité','each','c/u','cad.'),
  recurrence:   i('Récurrence','Recurrence','Recurrencia','Ricorrenza'),
  weekly:       i('Chaque semaine','Every week','Cada semana','Ogni settimana'),
  weekly_expl:  i('un panier par semaine, le jour choisi ci-dessous.','one basket per week, on the day chosen below.','un cesto por semana, el día elegido abajo.','un cesto a settimana, nel giorno scelto qui sotto.'),
  no_day:       i('Aucun jour choisi — sélectionnez-en un.','No day chosen — pick one.','Ningún día elegido — selecciona uno.','Nessun giorno scelto — selezionane uno.'),
  start_date:   i('Date de début','Start date','Fecha de inicio','Data di inizio'),
  optional:     i('(facultatif)','(optional)','(opcional)','(facoltativo)'),
  total_deliv:  i('Total par livraison','Total per delivery','Total por entrega','Totale per consegna'),
  at_day_price: i('au tarif du jour','at today\'s prices','al precio de hoy','al prezzo di oggi'),
  missing:      i('Il manque :','Missing:','Falta:','Manca:'),
  miss_customer:i('le client','the customer','el cliente','il cliente'),
  miss_name:    i('le nom du panier','the basket name','el nombre del cesto','il nome del cesto'),
  miss_items:   i('au moins un produit','at least one product','al menos un producto','almeno un prodotto'),
  miss_day:     i('le jour de livraison','the delivery day','el día de entrega','il giorno di consegna'),
  first_deliv:  i('Première livraison :','First delivery:','Primera entrega:','Prima consegna:'),
  then_every:   i('puis chaque','then every','luego cada','poi ogni'),
  remove_prod:  i('Retirer le produit','Remove product','Quitar producto','Rimuovi prodotto'),
  dec_qty:      i('Réduire la quantité','Decrease quantity','Reducir cantidad','Riduci quantità'),
  inc_qty:      i('Augmenter la quantité','Increase quantity','Aumentar cantidad','Aumenta quantità'),
  change_cust:  i('Changer de client','Change customer','Cambiar cliente','Cambia cliente'),
  line_sub:     i('Sous-total ligne','Line subtotal','Subtotal de línea','Subtotale riga'),
  name_ph:      i('ex. Panier hebdo Marie','e.g. Marie weekly basket','ej. Cesta semanal de Marie','es. Cesto settimanale di Marie'),
  note_ph:      i('Instructions de livraison, préférences…','Delivery instructions, preferences…','Instrucciones de entrega, preferencias…','Istruzioni di consegna, preferenze…'),
  err_save:     i('Erreur à l\'enregistrement','Save failed','Error al guardar','Errore di salvataggio'),
}

export function tx(key: keyof typeof T, lang: string): string {
  const entry = T[key] as Record<string,string>
  return entry[lang] ?? entry.fr
}

// ─── Couleur du montant total ─────────────────────────────────────────────────
/**
 * ⚠️ MESURÉ, pas supposé : `--acc` (#FFB020) sur le panneau or en thème CLAIR donne
 * un ratio de **1,57:1** — il échoue même l'AA « large text » (3:1). En thème sombre
 * le même couple monte à **9,17:1**. Le montant bascule donc sur `--text` en clair
 * (14,68:1) tandis que le panneau teinté or, lui, est conservé dans les deux thèmes :
 * c'est le panneau qui porte l'accent, pas le chiffre.
 *
 * `isThemeLight` résout aussi « system » (préférence OS) — ne jamais comparer
 * littéralement à 'light'.
 */
export function totalAmountColor(theme: string): string {
  return isThemeLight(theme) ? 'var(--text)' : 'var(--acc)'
}

// ─── Champs manquants ─────────────────────────────────────────────────────────
export type MissingField = 'customer' | 'name' | 'items' | 'day'

const MISSING_LABEL: Record<MissingField, keyof typeof T> = {
  customer: 'miss_customer', name: 'miss_name', items: 'miss_items', day: 'miss_day',
}

/**
 * Ce qui empêche encore d'enregistrer. Liste vide = enregistrable.
 * Le jour en fait partie : il n'a AUCUNE présélection, et l'API le refuse absent.
 */
export function missingSubscriptionFields(state: {
  hasCustomer: boolean; name: string; itemCount: number; dayOfWeek: number | null
}): MissingField[] {
  const out: MissingField[] = []
  if (!state.hasCustomer) out.push('customer')
  if (!state.name.trim()) out.push('name')
  if (state.itemCount < 1) out.push('items')
  if (state.dayOfWeek === null) out.push('day')
  return out
}

/** « Il manque : le client, au moins un produit. » */
export function missingLabel(missing: MissingField[], lang: string): string {
  if (missing.length === 0) return ''
  return `${tx('missing', lang)} ${missing.map(m => tx(MISSING_LABEL[m], lang)).join(', ')}.`
}

// ─── Total ────────────────────────────────────────────────────────────────────
/**
 * Total d'une livraison, en XOF base — **dérivé** du prix catalogue courant
 * (`product.sellPrice`), car le modèle ne stocke aucun total. Il suit donc le
 * catalogue : d'où le sous-titre « au tarif du jour », qui évite de le présenter
 * comme un montant figé.
 */
export function subscriptionTotal(items: { quantity: number; product: { sellPrice: number } }[]): number {
  return items.reduce((s, it) => s + it.product.sellPrice * it.quantity, 0)
}

// ─── Première livraison ───────────────────────────────────────────────────────
/**
 * Date de la première livraison réelle.
 *
 * ⚠️ Ce n'est PAS la date de début saisie : le serveur ne livre que les jours où
 * `dayOfWeek` tombe (cf. `GET /api/subscriptions/due`). Une date de début fixée un
 * lundi sur un abonnement livré le jeudi donne une première livraison le jeudi
 * suivant. Afficher la date saisie telle quelle serait une promesse fausse.
 *
 * Départ = la plus TARDIVE entre la date de début et aujourd'hui (une date passée
 * ne ressuscite pas une livraison écoulée). Calcul en UTC — même convention que la
 * borne serveur. `today` est INJECTÉ (fonction pure).
 */
export function firstDeliveryFrom(startDateIso: string, dayOfWeek: number | null, today: Date): Date | null {
  if (dayOfWeek === null) return null
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const start = startDateIso ? Date.parse(`${startDateIso}T00:00:00.000Z`) : NaN
  const from = Number.isNaN(start) ? todayUtc : Math.max(start, todayUtc)
  const fromDate = new Date(from)
  const delta = (dayOfWeek - fromDate.getUTCDay() + 7) % 7
  return new Date(from + delta * 86_400_000)
}

/** ISO (ou Date) → `YYYY-MM-DD` pour un `<input type="date">`. '' si absent/invalide. */
export function toDateInput(value?: string | null): string {
  if (!value) return ''
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10)
}
