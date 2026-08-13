import { useState } from 'react'

/**
 * LA VIGNETTE PRODUIT — rendu UNIQUE, photo ou émoji.
 *
 * ─── POURQUOI UN RENDU PARTAGÉ ───────────────────────────────────────────────
 * MESURÉ le 2026-08-11 : NEUF surfaces rendaient l'émoji produit en ligne, sans
 * rien partager — POS web, POS mobile, catalogue public, nouvelle commande,
 * transferts de stock (×3), abonnements (×2). C'est l'état exact de l'avatar
 * employé avant ce matin, où le même défaut avait produit cinq copies dont une
 * divergente. *Un rendu dupliqué n'est pas un rendu : c'est un futur écart.*
 *
 * ─── CE QUE CE COMPOSANT DÉCIDE ──────────────────────────────────────────────
 * La photo l'emporte sur l'émoji ; l'émoji reste le repli, et il est TOUJOURS là
 * (`Product.emoji` est `@default("📦")` NOT NULL côté base). Il n'existe donc pas
 * d'état « rien » : une vignette ne peut pas être vide.
 *
 * ⚠️ UNE URL QUI CASSE DOIT REVENIR À L'ÉMOJI, PAS À L'ICÔNE D'IMAGE BRISÉE.
 * `Product.image` porte une URL vers un stockage objet — donc une ressource qui
 * peut disparaître (objet supprimé) ou être injoignable (boutique hors ligne, et
 * c'est le cas NORMAL en Afrique de l'Ouest). Sans ce repli, une caisse hors ligne
 * afficherait une grille de glyphes d'image cassée : strictement PIRE que l'émoji
 * qu'on avait avant d'ajouter les photos. Même famille que « l'absence se dit »
 * (`ratingSummary` → `null`, jamais `0`).
 *
 * ⚠️ TROIS ÉTATS, PAS DEUX — ET LE TROISIÈME EST LE CAS NORMAL. « photo OU émoji »
 * oublie le CHARGEMENT : entre la pose de l'URL et la peinture de l'image, un
 * `<img>` seul ne rend RIEN. Sur un réseau de boutique ouest-africaine cette
 * fenêtre dure des secondes, et elle a duré ici jusqu'au 2026-08-12 — une grille
 * de caisse VIDE, c'est-à-dire exactement ce que le repli d'erreur existe pour
 * empêcher, à un `onError` près qui ne partira jamais puisque rien n'a échoué.
 * L'émoji tient donc la place SOUS l'image jusqu'à `onLoad`. Corollaire gratuit :
 * `loading="lazy"` ne déclenche rien hors écran, donc une grille défilante montre
 * ses émojis au lieu de trous.
 *
 * ⚠️ L'ÉTAT EST CLÉ PAR L'URL, jamais un simple booléen. `casse`/`chargé` sont un
 * état de COMPOSANT : dans une liste recyclée React réutilise l'instance et seul
 * le `<img>` est remonté par sa `key`. Un booléen ferait donc hériter le produit
 * suivant de l'échec du précédent — il n'afficherait plus jamais sa photo. (Ce
 * fichier a AFFIRMÉ le contraire jusqu'au 2026-08-12 : la `key` remonte l'élément,
 * elle ne réinitialise pas l'état. *Un commentaire jamais exécuté survit des mois.*)
 *
 * ⚠️ `data-thumb` — poignée des verrous de GÉOMÉTRIE (`e2e/dev/table-density`).
 * Elle vaut « photo » ou « secours » selon la branche rendue, et c'est ce qui permet
 * de mesurer les onze appels RÉELS sans que chaque surface ait à se faire repérer par
 * une classe ou un style : les deux se changent légitimement, la poignée non. Elle
 * porte aussi l'information « laquelle des deux branches a été rendue », qu'aucune
 * mesure de rectangle ne pourrait retrouver.
 *
 * ⚠️ DÉCORATIF, DONC MUET. `aria-hidden` + `alt=""` : les neuf surfaces nomment
 * déjà le produit en texte à côté. Une vignette qui s'annonce ferait lire le nom
 * deux fois par un lecteur d'écran.
 */
export default function ProductThumb({
  p,
  size = 38,
  radius = 'var(--r-md)',
  fontSize = 'var(--fs-2xl)',
  style,
  fallback,
}: {
  p: { image?: string | null; emoji?: string | null; name?: string }
  /** Côté de la vignette. Les surfaces vont de 14 px (puce d'abonnement) à 64 px (catalogue). */
  size?: number | string
  radius?: string | number
  /** Taille de l'émoji de repli — suit la vignette, elle n'est pas dérivable d'un `size` en `%`. */
  fontSize?: string | number
  /**
   * ⚠️ La chrome reste à L'APPELANT. Ce composant décide « photo ou émoji », pas à quoi
   * ressemble la boîte : les surfaces ont des fonds, bordures et rayons différents, et
   * les uniformiser serait un refactor visuel que personne n'a demandé. *Un goulot ne
   * doit pas être un entonnoir.*
   */
  style?: React.CSSProperties
  /**
   * Rendu quand il n'y a NI photo NI émoji. Deux surfaces (abonnements) affichent une
   * icône Lucide plutôt qu'un émoji par défaut — comportement conservé tel quel.
   */
  fallback?: React.ReactNode
}) {
  // On mémorise l'URL CONCERNÉE, pas un booléen : voir l'en-tête. Une comparaison
  // au rendu suffit — ni effet, ni synchronisation à écrire.
  const [echouee, setEchouee] = useState<string | null>(null)
  const [peinte, setPeinte] = useState<string | null>(null)
  const casse = !!p.image && echouee === p.image
  const chargee = !!p.image && peinte === p.image

  const commun: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
    ...style,
  }
  const secours = p.emoji || fallback || '📦'

  if (p.image && !casse) {
    return (
      <div data-thumb="photo" style={{ ...commun, overflow: 'hidden', position: 'relative', fontSize }} aria-hidden="true">
        {/* L'émoji tient la place TANT QUE l'image n'est pas peinte. Il disparaît
            ensuite : une photo à fond transparent laisserait sinon voir l'émoji
            au travers, ce qui est un défaut d'affichage et non un repli. */}
        {!chargee && secours}
        <img
          key={p.image}
          src={p.image}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setPeinte(p.image!)}
          onError={() => setEchouee(p.image!)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    )
  }

  return (
    <div data-thumb="secours" style={{ ...commun, fontSize }} aria-hidden="true">
      {secours}
    </div>
  )
}
