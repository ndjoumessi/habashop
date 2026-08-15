/**
 * ÉQUIVALENT TEXTUEL D'UNE COURBE — les valeurs, atteignables au clavier.
 *
 * ⚠️ POURQUOI SEULEMENT LES COURBES. Mesuré le 2026-08-15 sur les QUATRE graphiques du
 * produit : le donut des paiements (`ReportsTabs`) porte déjà une légende où chaque part est
 * un `role="button" tabIndex={0}` avec `aria-label` donnant nom, pourcentage ET effectif ;
 * le donut du Dashboard porte une légende nom + pourcentage. Ces deux-là étaient donc DÉJÀ
 * lisibles sans la souris. Les deux COURBES TEMPORELLES, elles, n'avaient aucun équivalent :
 * leurs valeurs n'existaient que dans un tooltip au survol.
 * Mon audit annonçait « tooltips inatteignables, 0/6 » — c'était trop large, et une
 * correction posée partout aurait ajouté du bruit là où l'information était déjà là.
 *
 * ⚠️ UNE LÉGENDE NE MARCHE PAS POUR UNE SÉRIE. Un donut a 4 à 6 parts, une courbe en porte
 * jusqu'à 90 : d'où un `<details>` replié, qui ne coûte rien à l'œil et rend tout au clavier
 * et au lecteur d'écran.
 *
 * ⚠️ AUCUNE MISE EN FORME ICI. L'appelant passe des chaînes déjà formatées : c'est lui qui
 * détient la devise, la langue et l'abréviation. Formater ici aurait recréé un deuxième
 * endroit où le montant se décide — la famille de défauts la plus chère de ce dépôt.
 */
export default function ChartDataTable({ resume, colonnes, lignes }: {
  /** Libellé du repli, déjà traduit. */
  resume: string
  /** En-têtes, déjà traduits. */
  colonnes: [string, string]
  /** Lignes, valeurs DÉJÀ formatées par l'appelant. */
  lignes: { cle: string; label: string; valeur: string }[]
}) {
  if (lignes.length === 0) return null
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 'var(--fs-caption)', color: 'var(--text3)',
        padding: '6px 2px', userSelect: 'none',
      }}>
        {resume}
      </summary>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-caption)' }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text3)', fontWeight: 'var(--fw-semibold)', borderBottom: '1px solid var(--border)' }}>
                {colonnes[0]}
              </th>
              <th scope="col" style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text3)', fontWeight: 'var(--fw-semibold)', borderBottom: '1px solid var(--border)' }}>
                {colonnes[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => (
              <tr key={l.cle}>
                <th scope="row" style={{ textAlign: 'left', padding: '3px 8px', color: 'var(--text2)', fontWeight: 'var(--fw-regular)' }}>
                  {l.label}
                </th>
                <td style={{ textAlign: 'right', padding: '3px 8px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                  {l.valeur}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
