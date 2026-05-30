import type React from 'react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ClipboardList } from 'lucide-react'
import { useConfig } from '@/stores/appStore'
import { type L4, makeI, pick, panel, Head } from '@/components/settings/settingsShared'
import AccountingReportModal from '@/components/settings/AccountingReportModal'

export default function SectionDocs() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const importRef = useRef<HTMLInputElement>(null)
  const [showReport, setShowReport] = useState(false)

  const exportConfig = () => {
    const blob = new Blob([cfg.exportConfig()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `habashop-config-${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success(i('📥 Configuration exportée', '📥 Configuration exported', '📥 Configuración exportada', '📥 Configurazione esportata'))
  }
  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { cfg.importConfig(ev.target?.result as string); toast.success(i('✅ Configuration importée', '✅ Configuration imported', '✅ Configuración importada', '✅ Configurazione importata')) }
    reader.readAsText(file)
  }

  const DOCS: { icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string>; action: () => void }[] = [
    { icon: '📥', color: 'var(--p2)', label: { fr: 'Exporter la configuration', en: 'Export configuration', es: 'Exportar configuración', it: 'Esporta configurazione' }, desc: { fr: 'Sauvegarde tous vos paramètres (JSON)', en: 'Back up all your settings (JSON)', es: 'Respalda todos tus ajustes (JSON)', it: 'Backup di tutte le impostazioni (JSON)' }, action: exportConfig },
    { icon: '📤', color: 'var(--acc3,#00B8FF)', label: { fr: 'Importer la configuration', en: 'Import configuration', es: 'Importar configuración', it: 'Importa configurazione' }, desc: { fr: 'Restaure depuis un fichier JSON', en: 'Restore from a JSON file', es: 'Restaurar desde un archivo JSON', it: 'Ripristina da un file JSON' }, action: () => importRef.current?.click() },
    { icon: '💰', color: 'var(--warn)', label: { fr: 'Rapport comptable', en: 'Accounting report', es: 'Reporte contable', it: 'Report contabile' }, desc: { fr: 'Dépenses et revenus du mois', en: 'Monthly expenses and revenue', es: 'Gastos e ingresos del mes', it: 'Spese e ricavi del mese' }, action: () => setShowReport(true) },
    { icon: '📋', color: 'var(--p3)', label: { fr: 'Documentation', en: 'Documentation', es: 'Documentación', it: 'Documentazione' }, desc: { fr: 'Dépôt GitHub HabaShop', en: 'HabaShop GitHub repo', es: 'Repo GitHub HabaShop', it: 'Repo GitHub HabaShop' }, action: () => window.open('https://github.com/ndjoumessi/habashop', '_blank') },
    { icon: '🖨️', color: 'var(--text2)', label: { fr: 'Imprimer la configuration', en: 'Print configuration', es: 'Imprimir configuración', it: 'Stampa configurazione' }, desc: { fr: 'Imprime les paramètres actuels', en: 'Print current settings', es: 'Imprimir ajustes actuales', it: 'Stampa impostazioni correnti' }, action: () => window.print() },
    { icon: '♻️', color: 'var(--danger)', label: { fr: 'Réinitialiser', en: 'Reset', es: 'Restablecer', it: 'Ripristina' }, desc: { fr: 'Restaure les paramètres par défaut', en: 'Restore default settings', es: 'Restaurar ajustes por defecto', it: 'Ripristina impostazioni predefinite' }, action: () => { cfg.resetConfig(); toast.success(i('♻️ Paramètres réinitialisés', '♻️ Settings reset', '♻️ Ajustes restablecidos', '♻️ Impostazioni ripristinate')) } },
  ]

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head icon={<ClipboardList size={16} />} tint="rgba(255,149,0,.04)"
        title={i('Documents & Configuration', 'Documents & Configuration', 'Documentos & Configuración', 'Documenti & Configurazione')}
        sub={i('Exportez vos données et votre configuration', 'Export your data and configuration', 'Exporta tus datos y configuración', 'Esporta i tuoi dati e la configurazione')} />
      <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importConfig} />
      <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DOCS.map(d => (
          <button key={pick(lang, d.label)} type="button" onClick={d.action}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg3)'; el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg3)'; el.style.borderColor = 'var(--border)'; el.style.transform = 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${d.color}15`, border: `1px solid ${d.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{d.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{pick(lang, d.label)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pick(lang, d.desc)}</div>
            </div>
          </button>
        ))}
      </div>
      {showReport && <AccountingReportModal onClose={() => setShowReport(false)} />}
    </div>
  )
}
