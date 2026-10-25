import { createHmac, timingSafeEqual } from 'node:crypto'
import { appUrl } from './appUrl'

/**
 * Lien public d'une facture — SOURCE UNIQUE du jeton imprimé dans le QR code.
 *
 * Le QR code au pied de la facture doit s'ouvrir d'un scan, sans compte : le client
 * du commerçant n'en a pas (`Customer` est une fiche tenue par la boutique, il ne se
 * connecte jamais). Le papier qu'il a en main EST donc le justificatif d'accès, comme
 * un lien de reçu Stripe. Ce qui impose deux propriétés :
 *
 *   · **Non énumérable.** Le jeton porte un sceau HMAC-SHA256 de 96 bits. Sans lui,
 *     `/f/<cuid>` serait devinable dès qu'une seule facture a fuité (les cuid sont
 *     séquentiels dans le temps).
 *   · ⚠️ **Et c'est la SEULE garde.** Le plafond de requêtes par IP n'en est PAS un
 *     repli : Fastify tourne en `trustProxy: true`, donc l'appelant choisit sa clé de
 *     comptage en faisant varier `X-Forwarded-For` (cf. § Garde de dépense du guide).
 *     Un jeton court « puisque le rate-limit tient » serait un fail-open déguisé.
 *
 * ⚠️ **Jeton DÉRIVÉ, aucune colonne en base** : rien à migrer, rien à purger, et une
 * facture annulée n'a pas de jeton orphelin. Le prix de ce choix est écrit juste en
 * dessous — la rotation du secret tue tous les liens DÉJÀ IMPRIMÉS.
 */

/** Longueur du sceau en caractères base64url. 16 × 6 = 96 bits. */
const TAG_CHARS = 16
/** Séparateur id/sceau. Absent des cuid ([a-z0-9]) comme du base64url ([A-Za-z0-9-_]). */
const SEP = '.'

/**
 * Secret de signature des liens de facture — lu **À L'APPEL** (un test doit pouvoir
 * poser l'env avant d'exercer une route ; même convention que `appBaseUrl()` et que les
 * plafonds de la garde de dépense).
 *
 * ⚠️ **`INVOICE_LINK_SECRET` n'est PAS un second nom pour `JWT_SECRET`** : signer une
 * session et signer un document imprimé n'ont ni la même durée de vie ni le même coût de
 * rotation. La dette P0.1 ouverte prévoit de TOURNER `JWT_SECRET` (il a été commité sur
 * un dépôt public) — fait sans secret dédié, cette rotation rendrait muet le QR code de
 * **toutes les factures déjà remises aux clients**, sans qu'aucun signal ne parte.
 *
 * Le repli sur `JWT_SECRET` existe pour que la fonctionnalité marche sans nouvelle
 * variable (convention du dépôt : une clé absente rend inerte, elle ne lève pas). Mais
 * ⚠️ **poser `INVOICE_LINK_SECRET` avant la première facture imprimée** est le geste qui
 * découple les deux ; après, le découplage casse les liens déjà distribués.
 */
function linkSecret(): string {
  return envSecret('INVOICE_LINK_SECRET') || envSecret('JWT_SECRET')
}

/**
 * Lecture d'un secret d'environnement : absent, vide ou blanc ⇒ `''`, c'est-à-dire
 * « pas de secret » (et donc, ici, fonctionnalité inerte).
 *
 * ⚠️ **Écrit sans l'opérateur de coalescence, et c'est délibéré.** Le scan de secrets de la
 * CI refuse, dans `apps/backend/src`, le nom du secret de session suivi de cet opérateur :
 * il chasse le repli DANGEREUX (un secret de développement en dur comme valeur par défaut),
 * et il juge la FORME, pas la valeur — c'est ce qui le rend incontournable. Mon repli valait
 * la chaîne vide, donc l'inverse d'un danger ; mais élargir le garde pour laisser passer ce
 * cas-là l'aurait affaibli pour tout le monde. **On change le code, pas le garde.**
 * Ne pas « simplifier » cette fonction avec cet opérateur : la CI repasserait au rouge.
 *
 * ⚠️ Et ce scan **ne retire pas les commentaires avant de conclure** — il interdit donc
 * d'écrire en toutes lettres ce qu'il interdit. C'est pourquoi ce paragraphe décrit la
 * forme au lieu de la citer : l'avoir citée a coûté un deuxième rouge.
 */
function envSecret(name: 'INVOICE_LINK_SECRET' | 'JWT_SECRET'): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function seal(saleId: string, secret: string): string {
  // Le préfixe de domaine interdit qu'un sceau calculé ici vaille ailleurs : si un autre
  // lien signé apparaît un jour avec le même secret, les deux ne seront pas confondus.
  return createHmac('sha256', secret).update(`invoice:${saleId}`).digest('base64url').slice(0, TAG_CHARS)
}

/** Jeton `<saleId>.<sceau>`, ou `null` si aucun secret n'est posé (fonctionnalité inerte). */
export function invoiceToken(saleId: string): string | null {
  const secret = linkSecret()
  const id = String(saleId ?? '').trim()
  if (!secret || !id || id.includes(SEP)) return null
  return `${id}${SEP}${seal(id, secret)}`
}

/**
 * Identifiant de vente d'un jeton, ou `null` si le jeton est illisible, tronqué ou mal
 * signé. L'appelant n'apprend JAMAIS laquelle des trois causes s'applique — un code
 * distinct par cause dirait à un attaquant quelle moitié du jeton il a déjà juste.
 */
export function parseInvoiceToken(token: unknown): string | null {
  const secret = linkSecret()
  if (!secret) return null
  const raw = String(token ?? '').trim()
  const cut = raw.lastIndexOf(SEP)
  if (cut <= 0) return null
  const id = raw.slice(0, cut)
  const got = raw.slice(cut + 1)
  const want = seal(id, secret)
  // `timingSafeEqual` lève sur des longueurs différentes → on compare d'abord.
  if (got.length !== want.length) return null
  return timingSafeEqual(Buffer.from(got), Buffer.from(want)) ? id : null
}

/**
 * URL absolue de la facture publique (`https://…/f/<jeton>`) — ce qui est encodé dans le
 * QR code. `null` = pas de secret, donc pas de QR : une facture sans code vaut mieux
 * qu'un code qui mène à un 404.
 */
export function invoicePublicUrl(saleId: string): string | null {
  const token = invoiceToken(saleId)
  return token ? appUrl(`/f/${token}`) : null
}
