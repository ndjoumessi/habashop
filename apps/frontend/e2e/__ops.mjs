import { chromium } from '@playwright/test'
const BASE = process.argv[2] ?? 'http://localhost:4340'
const LAB  = process.argv[3] ?? 'LOCAL'
const b = await chromium.launch()
// Session admin plateforme : on injecte l'état d'auth pour atteindre /admin.
const seed = async (p) => {
  await p.addInitScript(() => {
    localStorage.setItem('habashop-auth', JSON.stringify({ state: {
      token: 'x', isAuthenticated: true,
      user: { id:'u', name:'Ops', email:'ops@habashop.com', role:'ADMIN', isPlatformAdmin:true },
      tenants: [], activeTenantId: null }, version: 0 }))
    localStorage.setItem('habashop-config', JSON.stringify({ state:{ lang:'fr', currency:'XOF', theme:'dark' }, version:0 }))
  })
}
for (const w of [2560, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 1080 } })
  await seed(p)
  await p.route('**/api/admin/stats', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
    totalTenants:0, totalUsers:0, totalSales:0, totalRevenue:0, totalProducts:0,
    fixtureTenants:4, mrrXof:0, mrrParPlan:[] }) }))
  await p.route('**/api/admin/tenants', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([
    { id:'demo-tenant-001', name:'HabaShop — Dakar Central', plan:'business', status:'active', currency:'XOF', country:'SN', createdAt:'2026-06-16T00:00:00Z', isFixture:true, revenue:25000000, lastActivityAt:'2026-08-01T00:00:00Z', _count:{users:5,products:40,sales:952} },
    { id:'demo-tenant-002', name:'Alimentation Koné — Abidjan', plan:'starter', status:'active', currency:'XOF', country:'CI', createdAt:'2026-06-16T00:00:00Z', isFixture:true, revenue:20000000, lastActivityAt:'2026-08-01T00:00:00Z', _count:{users:1,products:30,sales:893} },
    { id:'e2e-tenant', name:'HabaShop E2E', plan:'business', status:'active', currency:'EUR', country:'SN', createdAt:'2026-07-16T00:00:00Z', isFixture:true, revenue:4000000, lastActivityAt:null, _count:{users:1,products:10,sales:63} },
  ]) }))
  await p.route('**/api/auth/me', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
    id:'u', name:'Ops', email:'ops@habashop.com', role:'ADMIN', isPlatformAdmin:true, tenants:[] }) }))
  await p.route('**/api/admin/plan-requests', r => r.fulfill({ status:200, contentType:'application/json', body:'[]' }))
  await p.goto(BASE + '/admin', { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const r = await p.evaluate(() => {
    const body = document.body
    const dernier = [...document.querySelectorAll('.panel, [class*=panel]')].pop()
    const bas = dernier ? Math.round(dernier.getBoundingClientRect().bottom + scrollY) : 0
    return {
      hauteurContenu: bas, hauteurDoc: document.documentElement.scrollHeight,
      texte: body.innerText.replace(/\n+/g,' | ').slice(0, 380),
      badgesDemo: [...document.querySelectorAll('span')].filter(e => /démo \/ test/i.test(e.textContent??'')).length,
      onglet: [...document.querySelectorAll('[role=tab]')].map(e => (e.textContent??'').trim().replace(/\s+/g,' ')),
    }
  })
  console.log(`\n── ${LAB} ${w} px ──`)
  console.log('   onglets      :', r.onglet.join('  ·  '))
  console.log('   badges démo  :', r.badgesDemo)
  console.log('   contenu s\'arrête à', r.hauteurContenu, 'px · doc', r.hauteurDoc, 'px · vide en bas', Math.max(0, r.hauteurDoc - r.hauteurContenu), 'px')
  console.log('   texte        :', r.texte)
  await p.close()
}
await b.close()
