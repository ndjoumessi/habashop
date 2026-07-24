/**
 * Résolution d'un code SCANNÉ — cache local, puis serveur, puis constat honnête.
 *
 * Incident à l'origine : un scan qui ne matchait pas le cache local affichait
 * « Produit non trouvé » — une affirmation que le terminal ne peut PAS faire. Le
 * produit venait d'être créé ; seul le cache était en retard. Le POS interroge donc
 * le serveur AVANT de conclure, et ne parle jamais que de son propre catalogue.
 *
 * Trois invariants :
 *  1. **Jamais bloquant** — la résolution ne lève pas, ne suspend pas la caisse ;
 *     l'échéance est bornée et son dépassement est un `unresolved`, pas une erreur.
 *  2. **Fail-open** — serveur injoignable, hors-ligne, 404, timeout : même issue
 *     neutre, aucune de ces situations n'autorise à dire que le produit n'existe pas.
 *  3. **Aucun appel quand le cache suffit** — le chemin nominal reste hors-ligne.
 */

export type ScanResolution<P> =
  | { kind: 'local'; product: P }      // trouvé dans le cache — aucun réseau
  | { kind: 'remote'; product: P }     // absent du cache, résolu par le serveur
  | { kind: 'unresolved' }             // ni l'un ni l'autre → message honnête

/** Échéance par défaut : au-delà, on rend la main au caissier plutôt que de le faire attendre. */
export const SCAN_LOOKUP_DEADLINE_MS = 1200

/**
 * Borne une promesse dans le temps. Dépassement, rejet ou valeur nulle → `null`.
 * Ne rejette JAMAIS : c'est ce qui rend l'appelant incapable de bloquer une vente.
 */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>(resolve => {
    let settled = false
    const done = (v: T | null) => { if (!settled) { settled = true; resolve(v) } }
    const timer = setTimeout(() => done(null), ms)
    p.then(v => { clearTimeout(timer); done(v ?? null) })
     .catch(() => { clearTimeout(timer); done(null) })
  })
}

export async function resolveScannedCode<P>(
  raw: string,
  local: readonly P[],
  matches: (p: P, raw: string) => boolean,
  lookup: (code: string) => Promise<P | null>,
  opts: { deadlineMs?: number } = {},
): Promise<ScanResolution<P>> {
  const code = String(raw ?? '').trim()
  if (!code) return { kind: 'unresolved' }

  const hit = local.find(p => matches(p, code))
  if (hit) return { kind: 'local', product: hit }   // chemin nominal : zéro réseau

  const found = await withDeadline(lookup(code), opts.deadlineMs ?? SCAN_LOOKUP_DEADLINE_MS)
  return found ? { kind: 'remote', product: found } : { kind: 'unresolved' }
}
