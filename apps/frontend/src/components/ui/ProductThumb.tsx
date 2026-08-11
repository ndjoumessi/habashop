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
  // ⚠️ L'échec de chargement est un ÉTAT, pas un style : il faut un re-rendu pour
  // repasser à l'émoji. Réinitialisé par la `key` de l'URL — sans elle, un produit
  // remplaçant un autre dans une liste virtualisée hériterait de son échec.
  const [casse, setCasse] = useState(false)
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

  if (p.image && !casse) {
    return (
      <div style={{ ...commun, overflow: 'hidden' }} aria-hidden="true">
        <img
          key={p.image}
          src={p.image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setCasse(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div style={{ ...commun, fontSize }} aria-hidden="true">
      {p.emoji || fallback || '📦'}
    </div>
  )
}
