import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import ProductThumb from '@/components/ui/ProductThumb'
import { resizeToBlob, PRODUIT_MAX_PX } from '@/lib/imageResize'
import { productsApi } from '@/lib/api'
import { saved } from '@/lib/saved'
import { announce } from '@/lib/announce'

/**
 * LE CHAMP PHOTO D'UN PRODUIT — envoi, remplacement, retrait.
 *
 * ⚠️ CE N'EST PAS `StockForm.image`. Ce champ-là porte l'ÉMOJI : il est envoyé au
 * serveur en `emoji`, et il est même PRÉFIXÉ au nom du produit
 * (`form.image + ' ' + form.name`, `Stock.tsx`). Deux champs homonymes de sens
 * opposés — `Product.image` porte une URL de photo. Les fondre enverrait un émoji
 * comme URL ; c'est le piège que ce commentaire existe pour empêcher.
 *
 * ─── POURQUOI LA PHOTO NE PASSE PAS PAR LE FORMULAIRE ────────────────────────
 * Elle a son propre endpoint (`POST /api/products/:id/image`, multipart), donc
 * elle n'est PAS enregistrée par la soumission du produit. Deux conséquences
 * visibles à l'écran, et il faut les assumer plutôt que les masquer :
 *
 *  · PRODUIT EXISTANT — l'envoi part TOUT DE SUITE, dès le choix du fichier. Le
 *    commerçant voit sa photo sans attendre « Enregistrer », et un refus se dit
 *    immédiatement, à côté du champ concerné.
 *  · PRODUIT EN CRÉATION — il n'existe pas encore d'identifiant, donc rien ne peut
 *    être envoyé. Le fichier est mis EN ATTENTE et remonté au parent, qui
 *    l'enverra une fois le produit créé. L'aperçu est local (`createObjectURL`).
 *
 * ⚠️ LE CAS D'ÉCHEC PARTIEL EXISTE et n'est pas avalé : produit créé, photo
 * refusée. C'est le parent qui le DIT (cf. `Stock.tsx`) — ce composant rapporte,
 * il ne décide pas. *Un goulot ne doit pas être un entonnoir.*
 *
 * ⚠️ ON REDIMENSIONNE AVANT D'ENVOYER, et c'est ici que ça se joue : le serveur
 * n'a pas de `sharp`, son plafond de 3 Mo borne les OCTETS et pas les pixels. Sans
 * ce redimensionnement, une photo de téléphone partirait en 4000 px et serait
 * servie telle quelle dans la grille de caisse.
 */

const ACCEPTES = 'image/jpeg,image/png,image/webp'

export default function ProductPhotoField({
  productId,
  image,
  emoji,
  lang,
  onImage,
  onEnAttente,
}: {
  /** `null` = produit pas encore créé : l'envoi est différé. */
  productId: string | null
  /** URL déjà stockée, ou `null`. */
  image: string | null
  /** Émoji du produit — le repli affiché quand il n'y a pas de photo. */
  emoji?: string
  lang: string
  /** Appelé quand la photo a RÉELLEMENT changé côté serveur. */
  onImage: (url: string | null) => void
  /** Appelé en création : le fichier à envoyer une fois le produit créé. */
  onEnAttente: (blob: Blob | null) => void
}) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // ⚠️ Nommé `busy` et non `occupe` : le verrou `landingClaims` reconnaît une liste
  // FERMÉE de drapeaux de requête en vol (`loading|busy|saving|…`) pour exempter un
  // bouton désactivé. Élargir ce garde pour ma convenance de nommage serait le
  // desserrer — on prend le nom qu'il accepte.
  const [busy, setBusy] = useState(false)
  const [apercuLocal, setApercuLocal] = useState<string | null>(null)
  const champRef = useRef<HTMLInputElement>(null)

  // ⚠️ Une URL d'objet est une ressource, pas une chaîne : sans révocation elle
  // retient le fichier en mémoire tant que l'onglet vit.
  useEffect(() => () => { if (apercuLocal) URL.revokeObjectURL(apercuLocal) }, [apercuLocal])

  async function choisir(fichier: File | undefined) {
    if (!fichier) return
    setBusy(true)
    try {
      let octets: Blob
      try {
        octets = await resizeToBlob(fichier, PRODUIT_MAX_PX)
      } catch {
        // ⚠️ On NOMME l'échec de lecture. Un fichier illisible (HEIC sur un
        // navigateur qui ne le décode pas, fichier corrompu) échoue au canvas, PAS
        // au serveur : un message « envoi impossible » ferait chercher le réseau.
        const m = i('Image illisible — essayez un JPEG ou un PNG.', 'Unreadable image — try a JPEG or PNG.',
                    'Imagen ilegible — pruebe con JPEG o PNG.', 'Immagine illeggibile — provi JPEG o PNG.')
        announce(m)
        const { default: toast } = await import('react-hot-toast')
        toast.error(m)
        return
      }

      if (!productId) {
        // Création : rien à envoyer encore, on met de côté et on montre un aperçu.
        if (apercuLocal) URL.revokeObjectURL(apercuLocal)
        setApercuLocal(URL.createObjectURL(octets))
        onEnAttente(octets)
        announce(i('Photo prête, elle sera envoyée à la création.', 'Photo ready, it will be uploaded on creation.',
                   'Foto lista, se enviará al crear.', 'Foto pronta, sarà inviata alla creazione.'))
        return
      }

      // ⚠️ `saved()` : le message du SERVEUR est préféré au nôtre — lui seul sait
      // si c'est un format refusé (415), un quota atteint (403) ou un stockage non
      // configuré (503). Un « échec » générique enverrait chercher au mauvais endroit.
      let url: string | null = null
      const ok = await saved(
        productsApi.uploadImage(productId, octets).then(r => { url = r.image }),
        i('la photo du produit', 'the product photo', 'la foto del producto', 'la foto del prodotto'),
      )
      if (ok && url) {
        onImage(url)
        announce(i('Photo enregistrée.', 'Photo saved.', 'Foto guardada.', 'Foto salvata.'))
      }
    } finally {
      setBusy(false)
      // Le même fichier rechoisi doit redéclencher `change`.
      if (champRef.current) champRef.current.value = ''
    }
  }

  async function retirer() {
    if (!productId || !image) {
      // Rien n'est parti au serveur : on ne retire qu'un fichier en attente.
      if (apercuLocal) URL.revokeObjectURL(apercuLocal)
      setApercuLocal(null)
      onEnAttente(null)
      return
    }
    setBusy(true)
    try {
      const ok = await saved(
        productsApi.removeImage(productId),
        i('le retrait de la photo', 'the photo removal', 'la eliminación de la foto', 'la rimozione della foto'),
      )
      if (ok) {
        onImage(null)
        announce(i('Photo retirée.', 'Photo removed.', 'Foto eliminada.', 'Foto rimossa.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const affichee = apercuLocal ?? image
  const aQuelqueChose = !!affichee

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>
        {i('PHOTO', 'PHOTO', 'FOTO', 'FOTO')}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ProductThumb
          p={{ image: affichee, emoji }}
          size={64}
          style={{ background: 'var(--bg3)', border: '1.5px solid var(--border)' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => champRef.current?.click()}
              disabled={busy}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: busy ? 'default' : 'pointer', fontSize: 'var(--fs-sm)' }}
            >
              {busy
                ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                : <Camera size={15} />}
              {aQuelqueChose
                ? i('Remplacer', 'Replace', 'Reemplazar', 'Sostituisci')
                : i('Ajouter une photo', 'Add a photo', 'Añadir una foto', 'Aggiungi una foto')}
            </button>

            {aQuelqueChose && (
              <button
                type="button"
                onClick={retirer}
                disabled={busy}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-red)', cursor: busy ? 'default' : 'pointer', fontSize: 'var(--fs-sm)' }}
              >
                <Trash2 size={15} />
                {i('Retirer', 'Remove', 'Quitar', 'Rimuovi')}
              </button>
            )}
          </div>

          {/*
            ⚠️ CE QUI VA SE PASSER EST DIT AVANT, pas après. En création la photo
            n'est pas encore envoyée : le taire ferait croire à un enregistrement
            qui n'a pas eu lieu — la famille du toast de succès sur un PATCH refusé.
          */}
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
            {!productId && apercuLocal
              ? i('Envoyée à la création du produit.', 'Uploaded when the product is created.',
                  'Se enviará al crear el producto.', 'Inviata alla creazione del prodotto.')
              : i('JPEG, PNG ou WebP. Redimensionnée automatiquement.', 'JPEG, PNG or WebP. Resized automatically.',
                  'JPEG, PNG o WebP. Redimensionada automáticamente.', 'JPEG, PNG o WebP. Ridimensionata automaticamente.')}
          </span>
        </div>
      </div>

      <input
        ref={champRef}
        type="file"
        accept={ACCEPTES}
        onChange={e => void choisir(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-label={i('Choisir une photo de produit', 'Choose a product photo', 'Elegir una foto de producto', 'Scegli una foto prodotto')}
      />
    </div>
  )
}
