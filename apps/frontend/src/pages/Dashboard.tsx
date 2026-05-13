import { ShoppingCart, Package, TrendingUp, Users } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import KPICard from '@/components/ui/KPICard'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, formatCurrency } from '@/stores/appStore'

const salesData = [
  { month: 'Jan', ca: 1850000, marge: 420000 },
  { month: 'Fév', ca: 2100000, marge: 510000 },
  { month: 'Mar', ca: 1920000, marge: 445000 },
  { month: 'Avr', ca: 2380000, marge: 590000 },
  { month: 'Mai', ca: 2650000, marge: 680000 },
  { month: 'Juin', ca: 2420000, marge: 620000 },
]

const categoryData = [
  { name: 'Céréales', value: 680000 },
  { name: 'Corps gras', value: 520000 },
  { name: 'Épicerie', value: 410000 },
  { name: 'Hygiène', value: 290000 },
  { name: 'Laitiers', value: 380000 },
  { name: 'Conserves', value: 370000 },
]

const recentActivity = [
  { id: 1, type: 'vente', desc: 'Vente #1042 — Mamadou Diallo', amount: '+125 000 F CFA', time: 'il y a 5 min', color: 'var(--acc2)' },
  { id: 2, type: 'stock', desc: 'Alerte rupture — Huile Palme 5L', amount: '0 unités', time: 'il y a 12 min', color: 'var(--danger)' },
  { id: 3, type: 'vente', desc: 'Vente #1041 — Fatou Ndiaye', amount: '+87 500 F CFA', time: 'il y a 18 min', color: 'var(--acc2)' },
  { id: 4, type: 'commande', desc: 'Commande F#089 — SONACO', amount: '1 200 000 F CFA', time: 'il y a 1h', color: 'var(--acc)' },
  { id: 5, type: 'vente', desc: 'Vente #1040 — Ibrahim Koné', amount: '+215 000 F CFA', time: 'il y a 1h 20', color: 'var(--acc2)' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs" style={{ minWidth: 140 }}>
      <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'ca' ? 'CA' : 'Marge'} : {Math.round(p.value / 1000)}k F CFA
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { currency } = useAppStore()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bienvenue */}
      <div>
        <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
          Bonjour, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>
          Voici le résumé de votre activité — Mai 2026
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Chiffre d'affaires"
          value={formatCurrency(2650000, currency)}
          change="+12.4% vs mois dernier"
          changeType="positive"
          icon={<TrendingUp size={18} />}
          color="var(--p)"
        />
        <KPICard
          label="Transactions"
          value="1 247"
          change="+8.2% vs mois dernier"
          changeType="positive"
          icon={<ShoppingCart size={18} />}
          color="var(--acc2)"
        />
        <KPICard
          label="Panier moyen"
          value={formatCurrency(2125, currency)}
          change="-3.1% vs mois dernier"
          changeType="negative"
          icon={<Package size={18} />}
          color="var(--acc)"
        />
        <KPICard
          label="Clients actifs"
          value="384"
          change="+24 nouveaux"
          changeType="positive"
          icon={<Users size={18} />}
          color="var(--p2)"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Évolution CA */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              Évolution CA & Marge
            </h3>
            <span className="badge badge-purple text-xs">6 derniers mois</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B4EE8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5B4EE8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMarge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EC47E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0EC47E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ca" stroke="#5B4EE8" strokeWidth={2} fill="url(#gradCA)" />
              <Area type="monotone" dataKey="marge" stroke="#0EC47E" strokeWidth={2} fill="url(#gradMarge)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* CA par catégorie */}
        <div className="card">
          <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>CA par catégorie</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v: number) => [`${Math.round(v/1000)}k F CFA`, 'CA']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--p)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activité récente */}
      <div className="card">
        <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>
          Activité récente
        </h3>
        <div className="space-y-3">
          {recentActivity.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-110"
              style={{ background: 'var(--bg3)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: item.color }}
              />
              <p className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{item.desc}</p>
              <span className="text-sm font-semibold" style={{ color: item.color }}>{item.amount}</span>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
