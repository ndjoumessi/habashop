import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
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
    await new Promise(r => setTimeout(r, 600))
    if (email && password) {
      login({ id: '1', name: 'Nelson M.', email, role: 'admin', shopName: 'HabaShop — Central' }, 'demo-token')
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } else {
      setError('Identifiants incorrects')
    }
    setLoading(false)
  }

  return (
    <div id="loginScreen" className="show">
      <div className="login-card">
        <div className="login-logo">
          <div className="li">H</div>
          <div className="login-logo-txt">Haba<span>Shop</span></div>
        </div>
        <div className="login-h">Connexion</div>
        <div className="login-sub">Accédez à votre espace de gestion</div>

        {error && <div className="err show">{error}</div>}

        <form onSubmit={handleLogin}>
          <label className="fl">Email</label>
          <input
            className="fi"
            type="email"
            placeholder="admin@habashop.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <label className="fl">Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              className="fi"
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: 40 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-60%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 15 }}
            >{showPwd ? '🙈' : '👁'}</button>
          </div>
          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
          </button>
        </form>

        <div className="demo-box">
          <strong>Compte démo :</strong> admin@habashop.com / demo1234
          <br />
          <span
            style={{ color: 'var(--p2)', cursor: 'pointer', fontSize: 12 }}
            onClick={() => { setEmail('admin@habashop.com'); setPassword('demo1234') }}
          >→ Remplir automatiquement</span>
        </div>
      </div>
    </div>
  )
}
