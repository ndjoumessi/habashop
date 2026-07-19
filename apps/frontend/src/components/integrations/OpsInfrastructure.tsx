import { useAppStore } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { INTEGRATIONS_LIST, CATEGORY_OF, OPS_CATS, API_VERSION, CARD_DETAIL } from '@/pages/Integrations'

// ── Infrastructure OPÉRATEUR (étape 1bis) ────────────────────────────────────
// L'infra (base/hébergement/monitoring) récupérée depuis la page intégrations : elle
// n'a plus rien à faire chez le commerçant (publierait la stack). Vue factuelle pour
// l'opérateur : endpoint, version, détail, statut. L'étape 2 la condensera en bande
// « santé technique » ; ce composant reste la source réutilisable.
export default function OpsInfrastructure() {
  const lang = useAppStore(s => s.lang)
  const infra = INTEGRATIONS_LIST.filter(itg => OPS_CATS.has(CATEGORY_OF[itg.id]))

  return (
    <ResponsiveGrid min={260} gap={12}>
      {infra.map(itg => {
        const ok = itg.status === 'connected'
        const detail = CARD_DETAIL[itg.id]?.[lang] ?? CARD_DETAIL[itg.id]?.fr
        return (
          <div key={itg.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><itg.IconSvg /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{itg.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itg.endpoint}</div>
              </div>
              <span title={ok
                ? (lang === 'en' ? 'Operational' : lang === 'es' ? 'Operativo' : lang === 'it' ? 'Operativo' : 'Opérationnel')
                : (lang === 'en' ? 'Not configured' : lang === 'es' ? 'No configurado' : lang === 'it' ? 'Non configurato' : 'Non configuré')}
                style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ok ? 'var(--acc2)' : 'var(--text4)', boxShadow: ok ? '0 0 6px var(--acc2)' : 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px' }}>{API_VERSION[itg.id]}</span>
              {detail && <span style={{ color: 'var(--text3)' }}>{detail}</span>}
            </div>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
