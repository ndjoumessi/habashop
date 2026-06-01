import { useSyncExternalStore } from 'react'

// ─── Statut réseau : source de vérité UNIQUE et partagée ─────────────────────
// Un seul poller pour toute l'app (badge header + bannières) → impossible d'avoir
// deux signaux contradictoires. La détection s'appuie sur un ping réel du backend
// (`/health`), PAS sur `navigator.onLine` (faux négatifs fréquents : « offline »
// alors que l'API répond). Les events navigateur ne sont qu'un déclencheur de
// re-vérification, jamais la vérité. Défaut = « online » : on ne force JAMAIS
// l'état hors-ligne au chargement avant une vérification effective.

export type NetworkStatus = 'online' | 'offline' | 'checking'

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL ?? 'https://habashop-production.up.railway.app'

let status: NetworkStatus = 'checking'
const listeners = new Set<() => void>()
let started = false

function emit() { listeners.forEach(l => l()) }

function setStatus(next: NetworkStatus) {
  if (next === status) return
  status = next
  emit()
}

async function check() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
    setStatus(r.ok ? 'online' : 'offline')
  } catch {
    setStatus('offline')
  }
}

function ensureStarted() {
  if (started) return
  started = true
  check()
  setInterval(check, 30000)
  window.addEventListener('online', check)
  window.addEventListener('offline', check)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  ensureStarted()
  return () => { listeners.delete(listener) }
}

function getSnapshot(): NetworkStatus { return status }

/** Statut réseau partagé : 'checking' au tout premier rendu, puis 'online'/'offline'. */
export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'online')
}

/** Booléen « en ligne » — true tant qu'une vérification n'a pas explicitement échoué. */
export function useOnlineStatus(): boolean {
  return useNetworkStatus() !== 'offline'
}
