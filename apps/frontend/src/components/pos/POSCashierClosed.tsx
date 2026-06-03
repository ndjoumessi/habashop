import { Lock, Unlock } from 'lucide-react'
import { formatInCurrency } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { CASHIER_TEXTS } from './posShared'

type CashierText = (typeof CASHIER_TEXTS)['fr']

interface Props {
  ct: CashierText
  currency: Currency
  currencySymbol: string
  openingFundInput: string
  setOpeningFundInput: (v: string) => void
  cashierName: string
  cashierInitial: string
  locale: string
  onOpen: () => void
}

export default function POSCashierClosed({
  ct, currency, currencySymbol, openingFundInput, setOpeningFundInput,
  cashierName, cashierInitial, locale, onOpen,
}: Props) {
  const inputValue  = parseFloat(openingFundInput) || 0
  const displayFund = formatInCurrency(inputValue, currency)
  const fundPreview = null

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'calc(100vh - 54px)', background:'var(--bg)',
    }}>
      <div style={{
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:20, padding:'40px 48px',
        maxWidth:480, width:'100%', textAlign:'center',
        boxShadow:'0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{
          width:80, height:80, borderRadius:'50%',
          background:'rgba(91,78,232,.12)', border:'2px solid rgba(91,78,232,.25)',
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 20px',
        }}><Lock size={36} style={{ color:'var(--p2)' }} /></div>
        <h2 style={{ fontSize:22, fontWeight:900, color:'var(--text)', marginBottom:8, letterSpacing:'-0.5px' }}>
          {ct.closed_title}
        </h2>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:28, lineHeight:1.6 }}>
          {ct.closed_sub}
        </p>
        <div style={{ marginBottom:20, textAlign:'left' }}>
          <label style={{
            display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase',
            letterSpacing:'.5px', color:'var(--text3)', marginBottom:6,
          }}>{ct.fund_label}</label>
          <div style={{ position:'relative' }}>
            <input
              className="input"
              type="number"
              placeholder={ct.fund_placeholder}
              value={openingFundInput}
              onChange={e => setOpeningFundInput(e.target.value)}
              style={{ fontSize:16, textAlign:'right', paddingRight:60 }}
            />
            <span style={{
              position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
              fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text3)',
            }}>{currencySymbol}</span>
          </div>
          {openingFundInput && (
            <div style={{ marginTop:6, fontSize:12, color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:600 }}>
              {fundPreview ?? displayFund}
            </div>
          )}
        </div>
        <div style={{
          padding:'12px 16px', borderRadius:10,
          background:'var(--bg3)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:12,
          marginBottom:24, textAlign:'left',
        }}>
          <div style={{
            width:36, height:36, borderRadius:'50%',
            background:'linear-gradient(135deg,var(--p),var(--p2))',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:14, fontWeight:'var(--fw-bold)', flexShrink:0,
          }}>{cashierInitial}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{cashierName}</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>
              {ct.cashier_label} · {new Date().toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long' })}
            </div>
          </div>
        </div>
        <button
          onClick={onOpen}
          style={{
            width:'100%',
            background:'linear-gradient(135deg,var(--p),var(--p2))',
            border:'none', borderRadius:12, padding:'14px',
            fontSize:15, fontWeight:'var(--fw-bold)', color:'#fff',
            cursor:'pointer', fontFamily:'var(--font)',
            boxShadow:'0 6px 20px rgba(91,78,232,.4)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}
        ><Unlock size={16} /> {ct.open_btn}</button>
      </div>
    </div>
  )
}
