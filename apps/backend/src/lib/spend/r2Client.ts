import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { authorizeSpend } from './spendGuard'

/**
 * SEUL module autorisé à instancier le SDK S3 (Cloudflare R2).
 *
 * Verrouillé par `spendGuardAllowlist.test.ts`, comme Twilio, Anthropic, Resend
 * et Africa's Talking.
 *
 * ─── POURQUOI R2 EST UNE DÉPENSE, MÊME SI L'ÉGRESS EST GRATUIT ───────────────
 * Cloudflare ne facture pas la sortie, mais il facture le STOCKAGE au Go·mois et
 * les opérations de CLASSE A (dont `PutObject`). Un envoi n'est donc pas gratuit,
 * et surtout il est PERSISTANT : un message WhatsApp abusif coûte une fois, un
 * objet abusif coûte tous les mois jusqu'à ce que quelqu'un le supprime. C'est
 * précisément le profil qu'un tenant de démonstration — dont le mot de passe est
 * PUBLIC — peut exploiter sans limite.
 *
 * ⚠️ LA GARDE EST SUR L'ÉCRITURE, PAS SUR LA SUPPRESSION. `DeleteObject` est une
 * opération de classe B, gratuite, et elle REND de l'espace : la refuser sur
 * quota ferait grossir la facture au lieu de la contenir, et laisserait des
 * objets orphelins que plus rien ne référence. *Un garde qui empêche de ranger
 * n'est pas un garde.*
 *
 * ─── INERTE SANS CONFIGURATION ───────────────────────────────────────────────
 * Comme VAPID et le SMS : variables absentes ⇒ la fonctionnalité n'existe pas,
 * proprement, avec un code nommé. Elle ne tombe pas en panne, elle ne s'active
 * pas à moitié.
 */

export const STORAGE_NOT_CONFIGURED = 'STORAGE_NOT_CONFIGURED'

type Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

/**
 * Lue À L'APPEL, jamais au chargement du module — même raison que pour les
 * plafonds de quota : une variable posée après le démarrage du process est prise
 * en compte, et les tests peuvent la définir eux-mêmes.
 *
 * ⚠️ `publicBaseUrl` fait partie du contrat : sans elle on saurait ÉCRIRE un
 * objet mais pas fabriquer l'URL à ranger dans `Product.image`. Un stockage qui
 * écrit sans pouvoir rendre l'adresse est un stockage qui perd des données.
 */
function lireConfig(): Config | null {
  const accountId       = (process.env.R2_ACCOUNT_ID ?? '').trim()
  const accessKeyId     = (process.env.R2_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? '').trim()
  const bucket          = (process.env.R2_BUCKET ?? '').trim()
  const publicBaseUrl   = (process.env.R2_PUBLIC_BASE_URL ?? '').trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl }
}

export function isR2Configured(): boolean {
  return !!lireConfig()
}

/** La base publique, ou `null` si le stockage n'est pas configuré. */
export function publicBaseUrl(): string | null {
  return lireConfig()?.publicBaseUrl ?? null
}

function client(cfg: Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
}

export type PutResult =
  | { ok: true; url: string }
  | { ok: false; code: string; error: string }

/**
 * Écrit un objet et rend son URL publique.
 *
 * ⚠️ `CacheControl` à un an ET `immutable` : ce n'est sûr QUE parce que la clé
 * porte l'empreinte du contenu (cf. `productImageKey`). Le jour où quelqu'un
 * remplacerait la clé par un identifiant fixe, cette en-tête servirait l'ancienne
 * photo pendant un an — les deux décisions ne se séparent pas.
 */
export async function putProductImage(opts: {
  tenantId: string
  key: string
  body: Buffer
  contentType: string
}): Promise<PutResult> {
  const cfg = lireConfig()
  if (!cfg) {
    return { ok: false, code: STORAGE_NOT_CONFIGURED, error: 'Stockage des photos non configuré.' }
  }

  const decision = await authorizeSpend(opts.tenantId, 'storage', 1)
  if (!decision.ok) {
    return { ok: false, code: decision.code ?? 'SPEND_REFUSED', error: decision.message ?? 'Envoi refusé.' }
  }

  try {
    await client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return { ok: true, url: `${cfg.publicBaseUrl.replace(/\/+$/, '')}/${opts.key}` }
  } catch (err: unknown) {
    // ⚠️ Le message brut n'est pas rendu au client : il peut porter le nom du
    // bucket et l'identifiant de compte. Il est journalisé, pas retourné.
    console.error('❌ R2 putObject échoué:', err)
    return { ok: false, code: 'STORAGE_WRITE_FAILED', error: 'Enregistrement de la photo impossible.' }
  }
}

/**
 * Supprime un objet. Rend `false` sur échec SANS lever.
 *
 * ⚠️ FAIL-OPEN TRACÉ, comme `writeAudit`. Le seul appelant est le remplacement ou
 * le retrait d'une photo : si R2 refuse la suppression, l'ancien objet devient
 * orphelin — c'est du gaspillage, pas une perte de donnée. Faire échouer la
 * requête pour autant rendrait un commerçant incapable de changer sa photo parce
 * que l'ANCIENNE ne s'efface pas. On trace, et on continue.
 */
export async function deleteProductImage(key: string): Promise<boolean> {
  const cfg = lireConfig()
  if (!cfg) return false
  try {
    await client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
    return true
  } catch (err: unknown) {
    console.error('⚠️  R2 deleteObject échoué (objet orphelin):', key, err)
    return false
  }
}
