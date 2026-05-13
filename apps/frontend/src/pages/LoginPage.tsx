import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    if (email && password) {
      login({ id: '1', name: 'Nelson Djoumessi', email, role: 'admin', shopName: 'HabaShop — Dakar Central' }, 'demo-token')
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } else {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'var(--bg)',
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 10% -10%, rgba(99,102,241,0.15), transparent 60%),
          radial-gradient(ellipse 60% 40% at 90% 0%, rgba(20,184,166,0.10), transparent 50%)
        `
      }}
    >
      <div className="w-full max-w-sm animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-4"
            style={{ background: 'var(--grad-primary)', boxShadow: '0 12px 40px rgba(99,102,241,0.40)' }}
          >H</div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
            Haba<span style={{ color: 'var(--teal)' }}>Shop</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Gestion commerciale SaaS · Afrique</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 40px 80px rgba(0,0,0,0.40)' }}
        >
          <h2 className="text-base font-bold mb-5" style={{ color: 'var(--text)' }}>Connexion à votre espace</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text3)' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="admin@habashop.com" required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text3)' }}>Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10" placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-3">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { setEmail('admin@habashop.com'); setPassword('demo1234') }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--primary2)', border: '1px solid rgba(99,102,241,0.20)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ✨ Compte démo — admin@habashop.com / demo1234
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text3)' }}>
          © 2026 HabaShop · Confidentiel
        </p>
      </div>
    </div>
  )
}
