/**
 * Normalisation du MSISDN saisi au POS pour une demande de paiement MTN MoMo.
 *
 * ⚠️ EXTRAIT DE `pages/POS.tsx` le 2026-08-06, à l'IDENTIQUE. La fonction y vivait en
 * closure dans le composant, donc non importable — et `mtn-normalize.test.ts` en gardait
 * une COPIE manuelle, assumée en commentaire : « Mettre à jour ici si la fonction dans
 * POS.tsx change ». Dix-neuf cas validaient donc la copie, pas le code exécuté. C'est le
 * motif `payrollShared` de juillet, sur le numéro qui REÇOIT un paiement : une dérive
 * silencieuse envoie l'argent au mauvais numéro.
 *
 * ⚠️ IL EXISTE UNE TROISIÈME IMPLÉMENTATION, et elle DIVERGE :
 * `apps/backend/src/routes/campayPayment.ts` porte le même nom mais
 *   • retire aussi le POINT et applique `trim()` ;
 *   • n'a PAS le repli « 8–15 chiffres, tout pays » → elle rend `null` là où celle-ci
 *     accepte.
 * Les deux servent des prestataires différents (celle-ci → MTN, celle-là → Campay), donc
 * ce n'est pas une contradiction sur un même chemin — mais deux fonctions homonymes aux
 * règles différentes sont un piège. Non fusionnées ici : ce serait un refactor de surface
 * de paiement, pas une purge de test. Cf. le rapport de chantier.
 */
export function normalizeCameroonPhone(raw: string): string | null {
  const s = raw.replace(/[\s\-()]/g, '')            // garde + pour détecter +237
  if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1)  // +237XXXXXXXXX → 237XXXXXXXXX
  if (/^237[0-9]{9}$/.test(s))   return s           // déjà normalisé 12 chiffres
  if (/^6[0-9]{8}$/.test(s))     return `237${s}`   // 9 chiffres locaux → préfixer 237
  const d = s.replace(/^\+/, '')                    // retire + éventuel
  if (/^[0-9]{8,15}$/.test(d))   return d           // tout pays : 8–15 chiffres
  return null
}
