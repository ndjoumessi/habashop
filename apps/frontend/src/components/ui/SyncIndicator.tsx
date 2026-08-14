import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Check } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { productsApi } from '@/lib/api'
import { announce } from '@/lib/announce'
import {
  FRESHNESS_KINDS, oldestFreshness, freshnessAge, freshnessLabel, freshnessLevel, freshnessKindLabel,
} from '@/lib/dataFreshness'

/**
 * Indicateur « dernière synchro » — pied de sidebar (emplacement réservé).
 *
 * Affiche le PLUS ANCIEN des horodatages des données à conséquence. Un horodatage
 * global unique mentirait : il passerait au vert parce qu'une classe secondaire vient
 * de resynchroniser alors que les PRIX ont trois heures.
 *
 * Purement informatif : aucun palier ne restreint quoi que ce soit, et rien ici ne
 * peut empêcher d'encaisser.
 */
const i = (lang: string, fr: string, en: string, es: string, it: string) =>
  ({ fr, en, es, it }[lang as 'fr'] ?? fr)

export default function SyncIndicator() {
  const lang = useAppStore(s => s.lang)
  const freshness = useAppStore(s => s.freshness)
  const markFresh = useAppStore(s => s.markFresh)
  const bumpCatalog = useAppStore(s => s.requestCatalogRefresh)

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // ⚠️ La sidebar porte `overflow-y:auto` (index.css) : un panneau en `position:absolute`
  // y est COUPÉ (mesuré — le libellé et le bouton étaient tronqués au bord). On le rend
  // donc dans un PORTAL sur <body>, positionné depuis le rect du bouton.
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ left: Math.max(8, r.left), bottom: Math.max(8, window.innerHeight - r.top + 6) })
  }, [open])

  // Ré-évalue l'âge à intervalle lent : « il y a 3 min » doit vieillir tout seul.
  // Une minute — c'est de l'affichage, pas un poll réseau.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const now = Date.now()
  const oldest = oldestFreshness(freshness)
  const age = oldest ? (oldest.neverSynced ? null : freshnessAge(oldest.at, now)) : null
  const level = freshnessLevel(age)
  const label = freshnessLabel(age, lang)

  const dot = level === 'fresh' ? 'var(--acc2)' : level === 'aging' ? 'var(--warn)' : 'var(--text4)'
  const syncLabel = i(lang, 'Dernière synchro', 'Last sync', 'Última sincronización', 'Ultima sincronizzazione')
  const refreshLabel = i(lang, 'Rafraîchir', 'Refresh', 'Actualizar', 'Aggiorna')

  const refresh = async () => {
    if (busy) return
    setBusy(true)
    try {
      await productsApi.list()          // horodate SEULEMENT si le serveur a répondu
      markFresh('catalog')
      bumpCatalog()                     // un POS monté rafraîchit sa liste en mémoire
      announce(i(lang, 'Données à jour', 'Data up to date', 'Datos actualizados', 'Dati aggiornati'))
    } catch {
      // Échec réseau : on ne rajeunit RIEN et on ne prétend rien — l'horodatage
      // affiché reste l'ancien, ce qui est exactement la vérité.
      announce(i(lang, 'Rafraîchissement impossible', 'Refresh failed', 'Actualización imposible', 'Aggiornamento non riuscito'))
    } finally { setBusy(false) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${syncLabel} : ${label}`}
        title={`${syncLabel} : ${label}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', padding: '2px 0',
          color: 'var(--text4)', fontSize: 'var(--fs-caption)', cursor: 'pointer',
          fontFamily: 'var(--font)', lineHeight: 1.4,
        }}
      >
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={syncLabel}
          style={{
            position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 400,
            minWidth: 210, padding: 10,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-lg)',
          }}
        >
          <div style={{
            fontSize: 'var(--fs-caption)', letterSpacing: '.07em', textTransform: 'uppercase',
            color: 'var(--text4)', marginBottom: 7,
          }}>{syncLabel}</div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {FRESHNESS_KINDS.map(kind => {
              const at = freshness[kind]
              const a = at == null ? null : freshnessAge(at, now)
              return (
                <li key={kind} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 'var(--fs-label)' }}>
                  <span style={{ color: 'var(--text2)' }}>{freshnessKindLabel(kind, lang)}</span>
                  <span style={{ color: 'var(--text4)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                    {freshnessLabel(a, lang)}
                  </span>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            style={{
              marginTop: 9, width: '100%', minHeight: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 'var(--r-sm)', color: 'var(--text)',
              fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)',
              cursor: busy ? 'progress' : 'pointer',
            }}
          >
            {busy
              ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <><RefreshCw size={13} />{refreshLabel}</>}
          </button>

          {level === 'fresh' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 'var(--fs-caption)', color: 'var(--acc2)' }}>
              <Check size={11} aria-hidden />
              {i(lang, 'Données à jour', 'Data up to date', 'Datos actualizados', 'Dati aggiornati')}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
