import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useConfig, t } from '@/stores/appStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate   = useNavigate()
  const { login }  = useAuthStore()
  const { lang }   = useConfig()
  void lang // for t() reactivity

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    if (email && password) {
      login({ id: '1', name: 'Nelson Djoumessi', email, role: 'admin', shopName: 'HabaShop — Dakar Central' }, 'demo-token')
      toast.success('Connexion réussie !')
      navigate('/app/dashboard')
    } else {
      setError(t('login_error'))
    }
    setLoading(false)
  }

  return (
    <div
      id="loginScreen"
      className="show"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(91,78,232,.22) 0%, var(--bg) 65%)' }}
    >
      <div className="login-card">
        <div className="login-logo">
          <div className="li">H</div>
          <div className="login-logo-txt">Haba<em>Shop</em></div>
        </div>
        <div className="login-h">{t('login_title')}</div>
        <div className="login-sub">{t('login_subtitle')}</div>

        <div className={`err${error ? ' show' : ''}`}>{error}</div>

        <form onSubmit={handleLogin}>
          <label className="fl">{t('login_email')}</label>
          <input
            className="fi" type="email" placeholder="admin@habashop.com"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <label className="fl">{t('login_password')}</label>
          <div style={{ position: 'relative' }}>
            <input
              className="fi" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: 40 }} required
            />
            <button
              type="button" onClick={() => setShowPwd(!showPwd)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-60%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 15 }}
            >{showPwd ? '🙈' : '👁'}</button>
          </div>
          <button className="lbtn" type="submit" disabled={loading}>
            {loading ? `⏳ ${t('login_loading')}` : `🔐 ${t('login_submit')}`}
          </button>
        </form>

        <div className="demo-box">
          <strong>{t('login_demo')} :</strong> admin@habashop.com / demo1234
          <br />
          <span
            style={{ color: 'var(--p2)', cursor: 'pointer', fontSize: 12 }}
            onClick={() => { setEmail('admin@habashop.com'); setPassword('demo1234') }}
          >{t('login_autofill')}</span>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <span
            style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >{t('login_back')}</span>
        </div>
      </div>
    </div>
  )
}
