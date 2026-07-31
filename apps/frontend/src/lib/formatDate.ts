// Formate une date ISO ('YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm…') en 'JJ/MM/AAAA' —
// convention fr (aussi es/it) choisie pour l'app (Afrique de l'Ouest francophone).
//
// Parsing par DÉCOUPAGE DE CHAÎNE, pas `new Date(iso).toLocaleDateString()` : `new Date`
// interprète une date-seule 'YYYY-MM-DD' comme minuit UTC, que toLocaleDateString reconvertit
// dans le fuseau local — en UTC-1 ou moins, le jour recule d'un cran (le 05 s'affiche « 04 »).
// Le découpage lit les composantes telles qu'écrites, sans fuseau. `null`/vide → '—' ;
// format inattendu → rendu tel quel (jamais 'Invalid Date').
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}
