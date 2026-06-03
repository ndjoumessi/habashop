import { useEffect } from 'react'
import { router } from 'expo-router'

// Écran « leurre » de l'onglet Caisse. En usage normal il n'est JAMAIS affiché :
// le listener tabPress du _layout intercepte le tap et pousse /(app)/pos.
// Filet de sécurité (deeplink direct vers la route) : on POUSSE le POS plutôt
// que router.replace — replace reparente des vues dans le navigateur d'onglets
// → crash ReactClippingViewManager sous Fabric (cf. action rapide du dashboard).
export default function POSTab() {
  useEffect(()=>{ router.push('/(app)/pos') },[])
  return null
}
