import { lazy, type ComponentType } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { logger } from '@/lib/logger'

/**
 * CHARGEMENT D'UNE ROUTE QUI SURVIT À UN DÉPLOIEMENT.
 *
 * ─── LE DÉFAUT ───────────────────────────────────────────────────────────────
 * Vercel sert des chunks au nom HASHÉ. Quand un déploiement atterrit, l'`index.js` déjà chargé
 * dans l'onglet d'un commerçant continue de référencer des fichiers qui n'existent plus : le
 * prochain `React.lazy()` reçoit un 404. MESURÉ le 2026-10-01 — `POS-WA0amkoA.js`, le chunk du
 * build précédent, rendait 404 pendant que le build courant servait `POS-BPuiY4uw.js`.
 *
 * ⚠️ ET C'EST TOUTE L'APPLICATION QUI TOMBAIT, pas la route. `Sentry.ErrorBoundary` enveloppe
 * l'app entière (`main.tsx`) : le rejet remontait jusqu'à elle, et le commerçant perdait barre
 * latérale, en-tête et écran — jusqu'à un rechargement forcé qu'il n'a aucune raison de
 * deviner. « L'écran suivant » est souvent la CAISSE.
 *
 * ─── POURQUOI PAS UN RECHARGEMENT AUTOMATIQUE ───────────────────────────────
 * ⚠️ C'est le réflexe, et il est DESTRUCTEUR ici : `cart` est exclu de `partialize`
 * (`appStore`), donc un rechargement VIDE le panier. Un caissier au milieu d'une vente perdrait
 * ses lignes sans avoir rien demandé — on aurait remplacé un écran cassé par une perte de
 * données silencieuse, ce qui est pire. On explique, on PROPOSE, et on prévient quand un panier
 * est en cours.
 *
 * ─── POURQUOI ICI ET PAS DANS UNE FRONTIÈRE D'ERREUR ────────────────────────
 * Résolu au niveau du `lazy()`, le rejet n'atteint JAMAIS la frontière : la coquille de
 * l'application reste en vie, et avec elle le panier en mémoire. Une frontière, elle, remplace
 * tout — y compris ce qu'on cherche justement à préserver.
 *
 * ⚠️ UNE REPRISE, PAS ZÉRO, PAS TROIS. Un seul essai ne distingue pas une coupure réseau d'un
 * fichier disparu ; au-delà de deux, on insiste sur une URL qui ne reviendra pas — les chunks
 * sont immuables, un 404 sur un nom hashé est DÉFINITIF.
 */

const DELAI_REPRISE_MS = 600

/** Panneau de reprise — il DIT ce qui s'est passé et ce qu'il faut faire. */
function NouvelleVersion() {
  const lang = useAppStore(s => s.lang)
  // ⚠️ Lu au RENDU : le panier peut s'être vidé entre l'échec et l'affichage.
  const panier = useAppStore(s => s.cart.length)
  const tr = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  return (
    <div role="status" style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
      fontFamily: 'var(--font)', color: 'var(--text)',
    }}>
      <RefreshCw size={30} style={{ color: 'var(--p2)' }} />
      <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)' }}>
        {tr('Une nouvelle version d’HabaShop est disponible',
            'A new version of HabaShop is available',
            'Hay una nueva versión de HabaShop',
            'È disponibile una nuova versione di HabaShop')}
      </div>
      <div className="legal-muted" style={{ maxWidth: 460, fontSize: 'var(--fs-body)' }}>
        {tr('Cet écran n’a pas pu se charger parce que l’application a été mise à jour pendant que vous l’utilisiez. Rechargez pour continuer.',
            'This screen could not load because the app was updated while you were using it. Reload to continue.',
            'Esta pantalla no pudo cargarse porque la aplicación se actualizó mientras la usaba. Recargue para continuar.',
            'Questa schermata non si è caricata perché l’app è stata aggiornata mentre la usavate. Ricaricate per continuare.')}
      </div>

      {/*
        ⚠️ L'AVERTISSEMENT N'APPARAÎT QUE S'IL Y A QUELQUE CHOSE À PERDRE. Affiché toujours, il
        deviendrait du bruit — *une alerte qui crie toujours n'alerte plus quand elle devient
        vraie*. Le panier n'étant pas persisté, c'est la SEULE donnée qu'un rechargement détruit.
      */}
      {panier > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 460,
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
          color: 'var(--warn)', fontSize: 'var(--fs-label)',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            {tr(`Votre panier contient ${panier} ligne(s) : recharger le videra. Terminez la vente en cours avant, si vous le souhaitez.`,
                `Your cart holds ${panier} line(s): reloading will empty it. Finish the current sale first if you wish.`,
                `Su carrito tiene ${panier} línea(s): recargar lo vaciará. Termine la venta en curso antes, si lo desea.`,
                `Il carrello contiene ${panier} riga/e: ricaricare lo svuoterà. Completate prima la vendita in corso, se volete.`)}
          </span>
        </div>
      )}

      <button type="button" className="btn-primary" onClick={() => window.location.reload()}
        style={{ marginTop: 4, cursor: 'pointer' }}>
        {tr('Recharger', 'Reload', 'Recargar', 'Ricarica')}
      </button>
    </div>
  )
}

/**
 * ⚠️ `ComponentType` SANS générique, et surtout pas `any` : les routes ne prennent aucune prop,
 * et un `any` ici coûterait un cran de cliquet de lint pour aucune expressivité.
 */
type Chargeur = () => Promise<{ default: ComponentType }>

/**
 * `React.lazy` qui ne laisse jamais un chunk manquant casser l'application.
 *
 * ⚠️ Le rejet est RÉSOLU en composant de reprise, jamais propagé : c'est ce qui épargne la
 * coquille de l'app — et le panier.
 */
export function lazyRoute(charger: Chargeur) {
  return lazy(async () => {
    try {
      return await charger()
    } catch (premier) {
      await new Promise(r => setTimeout(r, DELAI_REPRISE_MS))
      try {
        return await charger()
      } catch (second) {
        // ⚠️ `logger`, jamais `console.*` : la convention du dépôt, et il filtre hors DEV.
        logger.warn('[chunk] écran indisponible après déploiement', premier, second)
        return { default: NouvelleVersion }
      }
    }
  })
}
