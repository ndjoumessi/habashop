import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useConfig, t } from '@/stores/appStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError } = useAuthStore()
  const { lang } = useConfig()
  void lang // for t() reactivity

  const [email,   setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      toast.success('Connexion réussie !')
      navigate('/app/dashboard')
    } catch {
      // error already set in store
    }
  }

  const handleDemoLogin = async () => {
    clearError()
    try {
      await login('admin@habashop.com', 'demo1234')
      toast.success('✅ Connexion réussie !')
      navigate('/app/dashboard')
    } catch {
      // Le fallback démo est géré dans authStore
      navigate('/app/dashboard')
    }
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
          <button className="lbtn" type="submit" disabled={isLoading}>
            {isLoading ? `⏳ ${t('login_loading')}` : `🔐 ${t('login_submit')}`}
          </button>
        </form>

        <div className="demo-box">
          <strong>{t('login_demo')} :</strong> admin@habashop.com / demo1234
          <br />
          <span
            style={{ color: 'var(--p2)', cursor: 'pointer', fontSize: 12, marginRight: 10 }}
            onClick={() => { setEmail('admin@habashop.com'); setPassword('demo1234') }}
          >{t('login_autofill')}</span>
          <span
            style={{ color: 'var(--acc2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            onClick={handleDemoLogin}
          >🚀 Connexion directe</span>
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
