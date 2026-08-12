import { useState, useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { productsApi, apiErrorMessage } from '@/services/api'
import { actionRedimension, PRODUIT_MAX_PX, PRODUIT_QUALITE } from '@/lib/productPhoto'
import { logger } from '@/lib/logger'

export type SourcePhoto = 'camera' | 'gallery'

/**
 * ⚠️ QUATRE ISSUES, PAS DEUX — et c'est le cœur de ce fichier.
 *
 * Un `string | null` ferait dire la même chose à « l'utilisateur a annulé »,
 * « la permission est refusée » et « l'envoi a échoué ». L'écran doit les
 * distinguer : une annulation ne dit RIEN, une permission refusée demande un
 * geste dans les réglages du téléphone, un échec mérite le message du serveur.
 * *Un goulot ne doit pas être un entonnoir.*
 */
export type ResultatPhoto =
  | { etat: 'ok'; url: string }
  | { etat: 'annule' }
  | { etat: 'permission' ; source: SourcePhoto }
  | { etat: 'echec'; message: string }

/**
 * Le retrait n'a que DEUX issues : il n'y a ni picker à annuler ni permission à
 * demander. Lui faire porter `ResultatPhoto` obligerait à inventer une `url` vide
 * pour le succès — un champ qui ne veut rien dire est un champ qu'on finit par lire.
 */
export type ResultatRetrait = { etat: 'ok' } | { etat: 'echec'; message: string }

/**
 * ENVOI D'UNE PHOTO DE PRODUIT depuis le téléphone.
 *
 * Suit le chemin déjà éprouvé par `useSupplierOcr` : permission → picker →
 * compression locale → multipart authentifié. Deux écarts VOULUS avec lui :
 *
 *  · la compression vise **512 px / qualité 0,82** (partagé avec le web par
 *    fixture), pas 1920/0,7 qui est un réglage d'OCR ;
 *  · elle borne le PLUS GRAND CÔTÉ, pas la largeur — une photo portrait prise au
 *    téléphone est le cas courant, et l'OCR ne la contraindrait pas.
 *
 * ⚠️ IL N'Y A PAS DE CRÉATION DE PRODUIT SUR MOBILE (`productsApi` n'expose que
 * `list` et `update`). Le produit existe donc TOUJOURS quand ce hook est appelé :
 * le cas « photo en attente » du web n'a pas d'équivalent ici. C'est une
 * simplification de SURFACE, pas un raccourci — si une création apparaît un jour,
 * il faudra le différé du web avec son échec partiel.
 */
export function useProductPhoto() {
  const [busy, setBusy] = useState(false)

  const envoyer = useCallback(async (productId: string, source: SourcePhoto): Promise<ResultatPhoto> => {
    // 1. Permission — refus NOMMÉ, pas un échec générique : le geste correctif
    //    est dans les réglages du téléphone, pas dans l'application.
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') return { etat: 'permission', source }

    // 2. Picker — annulation = on ne touche à RIEN. Ni chargement, ni erreur :
    //    fermer le sélecteur est une décision de l'utilisateur, pas une panne.
    const choisi = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (choisi.canceled) return { etat: 'annule' }
    const asset = choisi.assets?.[0]
    if (!asset?.uri) return { etat: 'annule' }

    setBusy(true)
    try {
      // 3. Compression locale. ⚠️ `quality: 1` au picker puis compression ICI, et
      //    non l'inverse : compresser deux fois empile les artefacts JPEG. Le
      //    picker rend l'original, `manipulateAsync` fait le seul ré-encodage.
      const action = actionRedimension(asset.width, asset.height, PRODUIT_MAX_PX)
      const out = await ImageManipulator.manipulateAsync(
        asset.uri,
        action ? [action] : [],
        { compress: PRODUIT_QUALITE, format: ImageManipulator.SaveFormat.JPEG },
      )

      // 4. Envoi. ⚠️ `FormData` de React Native prend un DESCRIPTEUR `{uri,name,type}`,
      //    jamais un `Blob` — c'est la divergence de fond avec le jumeau web, où
      //    l'on envoie des octets. Ici on envoie une référence de fichier.
      const { image } = await productsApi.uploadImage(productId, out.uri)
      return { etat: 'ok', url: image }
    } catch (e) {
      logger.warn('useProductPhoto envoi échoué:', e)
      // Le message du SERVEUR est préféré : lui seul distingue un format refusé
      // (415) d'un quota atteint (403) ou d'un stockage non configuré (503).
      return { etat: 'echec', message: apiErrorMessage(e) ?? 'photo_echec' }
    } finally {
      setBusy(false)
    }
  }, [])

  const retirer = useCallback(async (productId: string): Promise<ResultatRetrait> => {
    setBusy(true)
    try {
      await productsApi.removeImage(productId)
      return { etat: 'ok' }
    } catch (e) {
      logger.warn('useProductPhoto retrait échoué:', e)
      return { etat: 'echec', message: apiErrorMessage(e) ?? 'photo_retrait_echec' }
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, envoyer, retirer }
}
