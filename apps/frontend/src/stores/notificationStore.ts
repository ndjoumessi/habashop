import { create } from 'zustand'

export interface LiveNotif {
  id: string
  type: 'new_sale' | 'low_stock' | 'new_order' | 'new_customer' | string
  data: any
  ts: number
  read: boolean
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let currentToken: string | null = null
let manualClose = false

function wsUrl(token: string): string {
  const httpBase: string = (import.meta as any).env?.VITE_API_URL ?? 'https://habashop-production.up.railway.app'
  const base = httpBase.replace(/^http/, 'ws') // http→ws, https→wss
  return `${base}/api/ws?token=${encodeURIComponent(token)}`
}

interface NotifState {
  notifications: LiveNotif[]
  unreadCount: number
  connected: boolean
  connect: (token: string | null | undefined) => void
  disconnect: () => void
  markAllRead: () => void
  clear: () => void
}

export const useNotificationStore = create<NotifState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,

  connect: (token) => {
    if (!token) return
    if (ws && currentToken === token && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    currentToken = token
    manualClose = false
    try { ws?.close() } catch {}

    const sock = new WebSocket(wsUrl(token))
    ws = sock

    sock.onopen = () => set({ connected: true })

    sock.onmessage = (ev) => {
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.type === 'connected') { set({ connected: true }); return }
      if (msg.type === 'ping' || msg.type === 'error') return
      const notif: LiveNotif = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: msg.type,
        data: msg.data,
        ts: Date.now(),
        read: false,
      }
      set(s => ({ notifications: [notif, ...s.notifications].slice(0, 20), unreadCount: s.unreadCount + 1 }))
    }

    sock.onclose = () => {
      set({ connected: false })
      if (!manualClose && currentToken) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => get().connect(currentToken), 5000)
      }
    }

    sock.onerror = () => { try { sock.close() } catch {} }
  },

  disconnect: () => {
    manualClose = true
    currentToken = null
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    try { ws?.close() } catch {}
    ws = null
    set({ connected: false })
  },

  markAllRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 })),
  clear: () => set({ notifications: [], unreadCount: 0 }),
}))
