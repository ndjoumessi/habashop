import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulation login — remplacer par appel API réel
    await new Promise(r => setTimeout(r, 800))
    if (email && password) {
      login(
        {
          id: '1',
          name: 'Nelson Djoumessi',
          email,
          role: 'admin',
          shopName: 'Mon Commerce',
        },
        'demo-token'
      )
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } else {
      toast.error('Identifiants incorrects')
    }
    setLoading(false)
  }

  const loginDemo = () => {
    setEmail('admin@habashop.com')
    setPassword('demo1234')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, var(--p), var(--p2))', boxShadow: '0 8px 32px rgba(91,78,232,0.4)' }}
          >
            H
          </div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            Haba<span style={{ color: 'var(--p)' }}>Shop</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Gestion commerciale SaaS</p>
        </div>

        {/* Carte login */}
        <div className="card">
          <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text)' }}>Connexion</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text2)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="admin@habashop.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text2)' }}>
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text3)' }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={loginDemo}
              className="w-full text-center text-xs font-medium py-2 rounded-lg transition-all"
              style={{
                background: 'rgba(91,78,232,0.1)',
                color: 'var(--p2)',
                border: '1px solid rgba(91,78,232,0.2)',
              }}
            >
              Remplir avec le compte démo
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text3)' }}>
          © 2026 HabaShop — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
