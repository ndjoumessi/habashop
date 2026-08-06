import { sendTenantEmail, sendPlatformEmail } from '../lib/spend/resendClient'
import { appUrl, appBaseUrl, appHost } from '../lib/appUrl'

/**
 * Envois d'e-mails. Le SDK Resend vit dans `lib/spend/resendClient` (goulot gardé).
 *
 * `send()` prend un `tenantId` OPTIONNEL :
 *  • fourni  → e-mail opérationnel d'une boutique, soumis au garde de dépense ;
 *  • absent  → e-mail de cycle de vie SaaS (bienvenue, relances, essai expiré,
 *    confirmation d'abonnement), volontairement EXEMPT — le garder bloquerait
 *    l'e-mail qui annonce justement l'expiration ou la suspension.
 */

// ── Helper d'envoi sécurisé ──────────────────
async function send(opts: {
  to:      string
  subject: string
  html:    string
  text?:   string
  tenantId?: string | null
}): Promise<boolean> {
  const { tenantId, ...mail } = opts
  return tenantId ? sendTenantEmail(tenantId, mail) : sendPlatformEmail(mail)
}

// ── Template de base ─────────────────────────
function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background:#F4F4F8; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
    .wrapper { max-width:600px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#6C47FF,#8B6FFF); padding:32px 40px; text-align:center; }
    .header-logo { color:#fff; font-size:28px; font-weight:900; letter-spacing:-1px; margin:0; }
    .header-sub { color:rgba(255,255,255,.75); font-size:13px; margin:6px 0 0; }
    .body { padding:40px; color:#1A1A2E; }
    .body h1 { font-size:22px; font-weight:800; color:#1A1A2E; margin:0 0 12px; line-height:1.3; }
    .body p { font-size:15px; color:#444464; line-height:1.7; margin:0 0 16px; }
    .btn { display:inline-block; background:linear-gradient(135deg,#6C47FF,#8B6FFF); color:#fff!important; text-decoration:none; padding:14px 32px; border-radius:10px; font-weight:700; font-size:15px; margin:8px 0 24px; }
    .divider { height:1px; background:#EBEBF0; margin:24px 0; }
    .kpi-row { display:flex; gap:12px; margin:20px 0; flex-wrap:wrap; }
    .kpi { flex:1; min-width:120px; background:#F8F8FC; border-radius:10px; padding:14px 16px; text-align:center; }
    .kpi-val { font-size:20px; font-weight:900; color:#6C47FF; font-family:monospace; }
    .kpi-lbl { font-size:11px; color:#8888A8; margin-top:4px; text-transform:uppercase; letter-spacing:.5px; }
    .alert { background:#FFF3CD; border:1px solid #FFD86E; border-radius:10px; padding:14px 16px; font-size:14px; color:#856404; margin:16px 0; }
    .alert.danger { background:#FFF0F0; border-color:#FFB3B3; color:#A32D2D; }
    .alert.success { background:#F0FFF8; border-color:#86EFC0; color:#0A6B3D; }
    .footer { background:#F8F8FC; padding:24px 40px; text-align:center; }
    .footer p { font-size:12px; color:#8888A8; margin:4px 0; line-height:1.6; }
    .footer a { color:#6C47FF; text-decoration:none; }
    .flag-row { font-size:22px; letter-spacing:4px; margin:16px 0; text-align:center; }
    @media(max-width:600px) { .body,.footer { padding:24px 20px; } .kpi-row { flex-direction:column; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-logo"><img src="${appUrl('/pwa-192x192.png')}" width="34" height="34" alt="" style="vertical-align:middle;border-radius:8px;margin-right:9px;display:inline-block"/>HabaShop</p>
      <p class="header-sub">Gestion commerciale pour l'Afrique</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <div class="flag-row">🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇬🇳 🇨🇲</div>
      <p>© 2026 HabaShop · Logiciel SaaS pour commerces africains</p>
      <p>
        <a href="${appBaseUrl()}">${appHost()}</a> ·
        <a href="${appUrl('/login')}">Se connecter</a>
      </p>
      <p style="font-size:11px;color:#AAAACC;margin-top:12px;">
        Vous recevez cet email car vous avez créé un compte HabaShop.
        <a href="${appUrl('/unsubscribe')}">Se désabonner</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ════════════════════════════════════════════
// EMAIL 1 — Bienvenue après inscription
// ════════════════════════════════════════════
/**
 * Mention unique de l'écart de paiement — répétée dans les e-mails de cycle de vie.
 *
 * ⚠️ Elle N'EST PAS redondante avec la vitrine : un commerçant arrivé par un lien direct
 * vers /signup ne voit jamais la page tarifs. Sans elle, il découvrirait au 15ᵉ jour —
 * après avoir saisi son stock et ses clients — qu'il ne peut pas régler en ligne.
 * L'apprendre à ce moment-là coûte la confiance ; l'apprendre tôt ne coûte presque rien.
 *
 * Ton sobre : on dit ce qui marche (l'essai, le produit) et ce qui ne marche pas encore
 * (l'encaissement en ligne). Aucune excuse, aucun « bientôt » vague.
 */
function paymentNotice(): string {
  return `
    <div class="alert" style="background:#FFF7E6;border-left:4px solid #FFB020;">
      <strong>Le paiement en ligne n'est pas encore actif.</strong>
      Votre essai est complet et ne demande aucune carte. Pour continuer au-delà,
      écrivez-nous&nbsp;: nous convenons du règlement (Mobile&nbsp;Money ou virement)
      et nous activons votre plan.
    </div>`
}

export async function sendWelcomeEmail(opts: {
  to:        string
  shopName:  string
  ownerName: string
  plan:      string
}): Promise<boolean> {
  const { to, shopName, ownerName } = opts
  const firstName = ownerName.split(' ')[0]
  const eFirst    = escHtml(firstName)
  const eShop     = escHtml(shopName)
  const loginUrl  = appUrl('/login')

  const html = baseTemplate(`
    <h1>Bienvenue sur HabaShop, ${eFirst} ! 🎉</h1>
    <p>Votre boutique <strong>${eShop}</strong> est prête.
    Vous bénéficiez d'un <strong>essai gratuit de 14 jours</strong>
    pour explorer toutes les fonctionnalités.</p>

    <div style="text-align:center;margin:16px 0;"><img src="${appUrl('/pwa-192x192.png')}" width="48" height="48" alt="HabaShop" style="border-radius:12px;display:inline-block"/></div>

    <p>Avec HabaShop vous pouvez :</p>
    <ul style="color:#444464;font-size:15px;line-height:2;padding-left:20px;">
      <li>💵 Encaisser vos ventes avec la <strong>caisse POS</strong></li>
      <li>📦 Gérer votre <strong>stock en temps réel</strong></li>
      <li>👥 Suivre vos <strong>clients et leur fidélité</strong></li>
      <li>👔 Gérer vos <strong>employés et la paie</strong></li>
      <li>📊 Analyser vos <strong>ventes et rapports</strong></li>
    </ul>

    <div class="divider"></div>

    <p style="text-align:center;">
      <a href="${loginUrl}" class="btn">
        🚀 Commencer maintenant
      </a>
    </p>

    <div class="alert success">
      ✅ <strong>Conseil :</strong> Commencez par ajouter vos produits
      dans Stock → Nouveau produit, puis ouvrez la caisse dans POS.
    </div>

    ${paymentNotice()}

    <p>Des questions ? Répondez directement à cet email —
    nous répondons sous 24h.</p>
  `)

  return send({
    to,
    subject: `Bienvenue sur HabaShop, ${firstName} ! Votre essai de 14 jours commence maintenant`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL 2 — Rappel J-7 avant expiration
// ════════════════════════════════════════════
export async function sendTrialReminder7Days(opts: {
  to:         string
  shopName:   string
  ownerName:  string
  caToday:    number
  txCount:    number
  currency:   string
}): Promise<boolean> {
  const { to, shopName, ownerName, caToday, txCount } = opts
  const firstName   = ownerName.split(' ')[0]
  const eFirst      = escHtml(firstName)
  const eShop       = escHtml(shopName)
  const upgradeUrl  = appUrl('/app/upgrade')

  const html = baseTemplate(`
    <h1>Plus que 7 jours d'essai, ${eFirst}</h1>
    <p>Votre essai gratuit de <strong>${eShop}</strong>
    expire dans <strong>7 jours</strong>. Continuez sans interruption
    en passant au plan Pro.</p>

    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-val">${txCount}</div>
        <div class="kpi-lbl">Ventes enregistrées</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${caToday.toLocaleString('fr-FR')}</div>
        <div class="kpi-lbl">CA Total (XOF)</div>
      </div>
    </div>

    <div class="divider"></div>

    <p><strong>Plan Pro — 24 900 F CFA/mois</strong></p>
    <ul style="color:#444464;font-size:15px;line-height:2;padding-left:20px;">
      <li>✅ Ventes illimitées</li>
      <li>✅ Tous les modules (RH, Paie, Analytics avancés)</li>
      <li>✅ Support prioritaire sous 4h</li>
      <li>✅ Paiement par <strong>Wave ou Orange Money</strong></li>
    </ul>

    <p style="text-align:center;">
      <a href="${upgradeUrl}" class="btn">
        ⚡ Passer au plan Pro maintenant
      </a>
    </p>

    <div class="alert">
      ⏰ <strong>Votre essai expire dans 7 jours.</strong>
      Vos données sont conservées même après l'expiration —
      passez au Pro pour continuer à vendre sans interruption.
    </div>

    ${paymentNotice()}
  `)

  return send({
    to,
    subject: `⏰ ${firstName}, votre essai HabaShop expire dans 7 jours`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL 3 — Rappel J-3 urgent
// ════════════════════════════════════════════
export async function sendTrialReminder3Days(opts: {
  to:        string
  shopName:  string
  ownerName: string
}): Promise<boolean> {
  const { to, shopName, ownerName } = opts
  const firstName  = ownerName.split(' ')[0]
  const eFirst     = escHtml(firstName)
  const eShop      = escHtml(shopName)
  const upgradeUrl = appUrl('/app/upgrade')

  const html = baseTemplate(`
    <h1>🚨 Plus que 3 jours — ${eFirst}</h1>
    <p>L'essai gratuit de <strong>${eShop}</strong>
    expire dans <strong>3 jours</strong>.
    Après cette date, l'accès à votre caisse et vos données
    sera suspendu.</p>

    <div class="alert danger">
      🔴 <strong>Action requise :</strong> Abonnez-vous maintenant
      pour ne pas interrompre vos ventes.
    </div>

    <div class="divider"></div>

    <p style="text-align:center;">
      <a href="${upgradeUrl}" class="btn" style="background:linear-gradient(135deg,#FF3B5C,#dc2626);">
        🔓 Débloquer mon accès — 24 900 F CFA/mois
      </a>
    </p>

    <p style="text-align:center;font-size:13px;color:#8888A8;">
      Payez par Wave 🌊 · Orange Money 🟠 · MTN Money · Virement bancaire
    </p>

    <div class="divider"></div>

    <p>Vous avez des questions sur les tarifs ou les fonctionnalités ?
    Répondez à cet email — nous vous rappelons sous 2h.</p>

    ${paymentNotice()}
  `)

  return send({
    to,
    subject: `🔴 URGENT — Votre boutique ${shopName} sera suspendue dans 3 jours`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL 4 — Confirmation upgrade plan
// ════════════════════════════════════════════
export async function sendUpgradeConfirmation(opts: {
  to:        string
  shopName:  string
  ownerName: string
  plan:      string
  amount:    number
  method:    string
  ref?:      string
}): Promise<boolean> {
  const { to, shopName, ownerName, plan, amount, method, ref } = opts
  const firstName  = ownerName.split(' ')[0]
  const planLabel  = plan === 'pro' ? 'Pro' : 'Enterprise'
  const loginUrl   = appUrl('/login')

  const methodLabels: Record<string,string> = {
    wave:         'Wave 🌊',
    orange_money: 'Orange Money 🟠',
    mtn_money:    'MTN Money',
    virement:     'Virement bancaire',
    card:         'Carte bancaire',
  }

  const eFirst = escHtml(firstName)
  const eShop  = escHtml(shopName)

  const html = baseTemplate(`
    <h1>✅ Votre plan ${planLabel} est activé !</h1>
    <p>Félicitations ${eFirst} ! Votre boutique
    <strong>${eShop}</strong> est maintenant sur le plan
    <strong>${planLabel}</strong>. Toutes les fonctionnalités
    sont débloquées.</p>

    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-val">${planLabel}</div>
        <div class="kpi-lbl">Votre plan</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${amount.toLocaleString('fr-FR')}</div>
        <div class="kpi-lbl">F CFA / mois</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${methodLabels[method] ?? method}</div>
        <div class="kpi-lbl">Paiement</div>
      </div>
    </div>

    ${ref ? `<p style="font-size:12px;color:#8888A8;">Référence de paiement : <code>${escHtml(ref)}</code></p>` : ''}

    <div class="divider"></div>

    <div class="alert success">
      🎉 <strong>Accès illimité activé.</strong>
      Vos ventes, stock, employés et analytics sont
      maintenant disponibles sans restriction.
    </div>

    <p style="text-align:center;">
      <a href="${loginUrl}" class="btn">
        🚀 Accéder à mon tableau de bord
      </a>
    </p>

    <p>Merci de faire confiance à HabaShop pour gérer
    votre commerce. Nous sommes là pour vous accompagner.</p>
  `)

  return send({
    to,
    subject: `✅ Plan ${planLabel} activé — Bienvenue dans HabaShop Pro, ${firstName} !`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL 5 — Essai expiré
// ════════════════════════════════════════════
export async function sendTrialExpired(opts: {
  to:        string
  shopName:  string
  ownerName: string
}): Promise<boolean> {
  const { to, shopName, ownerName } = opts
  const firstName  = ownerName.split(' ')[0]
  const eFirst     = escHtml(firstName)
  const eShop      = escHtml(shopName)
  const upgradeUrl = appUrl('/app/upgrade')

  const html = baseTemplate(`
    <h1>Votre essai a expiré, ${eFirst}</h1>
    <p>L'essai gratuit de <strong>${eShop}</strong> est terminé.
    Votre compte est suspendu mais <strong>toutes vos données
    sont conservées</strong> — vos produits, clients et historique
    de ventes sont en sécurité.</p>

    <div class="alert danger">
      🔴 <strong>Compte suspendu.</strong>
      Réactivez votre boutique maintenant pour reprendre vos ventes.
    </div>

    <div class="divider"></div>

    <p style="text-align:center;">
      <a href="${upgradeUrl}" class="btn">
        🔓 Réactiver ma boutique — 24 900 F CFA/mois
      </a>
    </p>

    <p style="text-align:center;font-size:13px;color:#8888A8;">
      Wave · Orange Money · MTN Money · Virement
    </p>

    <div class="divider"></div>

    <p style="font-size:13px;color:#8888A8;text-align:center;">
      Vos données seront supprimées après 30 jours d'inactivité.
      Abonnez-vous maintenant pour les conserver.
    </p>
  `)

  return send({
    to,
    subject: `Votre boutique ${shopName} est suspendue — Réactivez maintenant`,
    html,
  })
}

// Échappement HTML — défense contre injection via shopName / userName / tempPassword
function escHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  )
}

// ════════════════════════════════════════════
// EMAIL — Alerte stock bas (cron quotidien)
// ════════════════════════════════════════════
export async function sendStockAlertEmail(opts: {
  /** Boutique émettrice — soumet l'envoi au garde de dépense (démo/essai/quota). */
  tenantId: string
  to:           string
  shopName:     string
  products:     { name: string; stockQty: number; stockMin: number }[]
}): Promise<boolean> {
  const { to, shopName, products } = opts
  const stockUrl = appUrl('/app/stock')
  const eShop = escHtml(shopName)
  const totalCount = products.length
  const outOfStock = products.filter(p => p.stockQty === 0).length
  const lowStock = totalCount - outOfStock

  // Tableau HTML des produits (limité à 20 pour ne pas exploser le mail)
  const rows = products.slice(0, 20).map(p => {
    const isOut = p.stockQty === 0
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #EBEBF0;">${escHtml(p.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #EBEBF0;text-align:right;color:${isOut ? '#A32D2D' : '#856404'};font-weight:700;font-family:monospace;">
          ${isOut ? '⚠️ RUPTURE' : p.stockQty}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #EBEBF0;text-align:right;color:#8888A8;font-family:monospace;">
          ${p.stockMin}
        </td>
      </tr>`
  }).join('')

  const moreNote = totalCount > 20
    ? `<p style="font-size:12px;color:#8888A8;text-align:center;">…et ${totalCount - 20} autre(s) — voir la liste complète dans l'app.</p>`
    : ''

  const html = baseTemplate(`
    <h1>⚠️ Alerte stock — ${eShop}</h1>
    <p>Bonjour, votre boutique <strong>${eShop}</strong> a
    <strong>${totalCount} produit${totalCount > 1 ? 's' : ''}</strong> qui nécessite${totalCount > 1 ? 'nt' : ''} votre attention :</p>

    <div class="kpi-row">
      ${outOfStock > 0 ? `
      <div class="kpi">
        <div class="kpi-val" style="color:#A32D2D;">${outOfStock}</div>
        <div class="kpi-lbl">Rupture totale</div>
      </div>` : ''}
      ${lowStock > 0 ? `
      <div class="kpi">
        <div class="kpi-val" style="color:#856404;">${lowStock}</div>
        <div class="kpi-lbl">Stock bas</div>
      </div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
      <thead>
        <tr style="background:#F8F8FC;">
          <th style="padding:10px;text-align:left;font-weight:700;color:#1A1A2E;">Produit</th>
          <th style="padding:10px;text-align:right;font-weight:700;color:#1A1A2E;">Stock</th>
          <th style="padding:10px;text-align:right;font-weight:700;color:#1A1A2E;">Seuil</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${moreNote}

    <p style="text-align:center;">
      <a href="${stockUrl}" class="btn">
        📦 Voir le stock
      </a>
    </p>

    <div class="alert">
      💡 <strong>Conseil :</strong> Pensez à réapprovisionner ces produits ou créer
      des bons de commande fournisseur depuis l'onglet Commandes.
    </div>

    <p style="font-size:12px;color:#8888A8;">
      Vous recevez cet email car les <strong>alertes stock</strong> sont activées
      dans vos préférences. Désactivez-les depuis Paramètres → Notifications si nécessaire.
    </p>
  `)

  return send({
    tenantId: opts.tenantId,
    to,
    subject: `⚠️ ${shopName} — ${totalCount} produit${totalCount > 1 ? 's' : ''} en alerte stock`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL — Invitation d'un nouvel utilisateur par un admin
// ════════════════════════════════════════════
export async function sendUserInvitationEmail(opts: {
  /** Boutique émettrice — soumet l'envoi au garde de dépense (démo/essai/quota). */
  tenantId: string
  to:           string
  inviteeName:  string
  shopName:     string
  tempPassword: string
  invitedBy?:   string
}): Promise<boolean> {
  const { to, inviteeName, shopName, tempPassword, invitedBy } = opts
  const firstName = inviteeName.split(' ')[0]
  const loginUrl  = appUrl('/login')

  // Toutes les valeurs interpolées dans le HTML viennent de données tenant/admin
  // potentiellement contrôlées — on les échappe pour éviter HTML/script injection.
  const eFirst = escHtml(firstName)
  const eShop  = escHtml(shopName)
  const eBy    = invitedBy ? escHtml(invitedBy) : ''
  const eTo    = escHtml(to)
  const ePwd   = escHtml(tempPassword)

  const html = baseTemplate(`
    <h1>Vous avez été invité sur HabaShop, ${eFirst} 👋</h1>
    <p>${eBy ? `<strong>${eBy}</strong> vous a invité` : 'Vous avez été invité'}
    à rejoindre la boutique <strong>${eShop}</strong> sur HabaShop.</p>

    <div class="alert">
      🔐 <strong>Vos identifiants temporaires :</strong>
      <div style="margin-top:8px;font-family:monospace;font-size:13px;line-height:1.8;">
        Email : <strong>${eTo}</strong><br/>
        Mot de passe temporaire : <strong>${ePwd}</strong>
      </div>
    </div>

    <p>Connectez-vous et changez votre mot de passe dans
    <strong>Paramètres → Sécurité</strong> à votre première connexion.</p>

    <p style="text-align:center;">
      <a href="${loginUrl}" class="btn">
        🚀 Se connecter à HabaShop
      </a>
    </p>

    <div class="divider"></div>

    <p style="font-size:13px;color:#8888A8;">
      Cet email contient un mot de passe sensible — ne le partagez avec personne.
      Si vous n'attendiez pas cette invitation, ignorez ce message ou contactez-nous.
    </p>
  `)

  return send({
    tenantId: opts.tenantId,
    to,
    subject: `Vous avez été invité sur HabaShop — ${shopName}`,
    html,
  })
}

// ════════════════════════════════════════════
// EMAIL 6 — Rapport hebdomadaire
// ════════════════════════════════════════════
export async function sendWeeklyReport(opts: {
  /** Boutique émettrice — soumet l'envoi au garde de dépense (démo/essai/quota). */
  tenantId: string
  to:          string
  shopName:    string
  ownerName:   string
  caWeek:      number
  txWeek:      number
  caLastWeek:  number
  topProduct:  string
  lowStock:    number
}): Promise<boolean> {
  const {
    to, shopName, ownerName,
    caWeek, txWeek, caLastWeek,
    topProduct, lowStock,
  } = opts
  const firstName = ownerName.split(' ')[0]
  const evolution = caLastWeek > 0
    ? Math.round((caWeek - caLastWeek) / caLastWeek * 100)
    : 0
  const evolLabel = evolution >= 0
    ? `+${evolution}% vs semaine dernière 📈`
    : `${evolution}% vs semaine dernière 📉`
  const dashUrl = appUrl('/app/dashboard')

  const html = baseTemplate(`
    <h1>📊 Rapport de la semaine — ${escHtml(shopName)}</h1>
    <p>Bonjour ${escHtml(firstName)}, voici le bilan de la semaine
    pour votre boutique.</p>

    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-val">${caWeek.toLocaleString('fr-FR')}</div>
        <div class="kpi-lbl">CA Semaine (XOF)</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${txWeek}</div>
        <div class="kpi-lbl">Transactions</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${txWeek > 0 ? Math.round(caWeek/txWeek).toLocaleString('fr-FR') : 0}</div>
        <div class="kpi-lbl">Panier moyen (XOF)</div>
      </div>
    </div>

    <p style="text-align:center;font-size:13px;color:#6C47FF;font-weight:700;">
      ${evolLabel}
    </p>

    <div class="divider"></div>

    <p>🏆 <strong>Produit star :</strong> ${topProduct}</p>

    ${lowStock > 0 ? `
    <div class="alert">
      ⚠️ <strong>${lowStock} produit${lowStock>1?'s':''} en rupture de stock</strong>
      — pensez à réapprovisionner avant de manquer des ventes.
    </div>
    ` : '<div class="alert success">✅ Stock en bonne santé — aucune rupture cette semaine.</div>'}

    <p style="text-align:center;">
      <a href="${dashUrl}" class="btn">
        📊 Voir le tableau de bord complet
      </a>
    </p>
  `)

  return send({
    tenantId: opts.tenantId,
    to,
    subject: `📊 ${shopName} — Bilan semaine : ${caWeek.toLocaleString('fr-FR')} F CFA (${evolLabel})`,
    html,
  })
}

// ── Récap paie mensuel (cron) — localisé 4 langues ──
// Source de données : Employee.salary (effectif actif) = masse salariale PROJETÉE
// (aucun modèle Payroll/Payslip historique) + EmployeeBonus du mois (réel).
type L4 = 'fr' | 'en' | 'es' | 'it'
const PAYROLL_I18N: Record<L4, {
  subject: string; title: string; greeting: string; intro: string
  headcount: string; payroll: string; projected: string; bonuses: string; total: string; note: string
}> = {
  fr: {
    subject: 'Récap paie', title: '💼 Récap paie', greeting: 'Bonjour',
    intro: 'Voici le récapitulatif de la paie de votre boutique',
    headcount: 'Effectif actif', payroll: 'Masse salariale', projected: 'projection — effectif actuel',
    bonuses: 'Primes versées sur le mois', total: 'Total estimé',
    note: 'La masse salariale est une projection basée sur l’effectif actuel (HabaShop ne stocke pas de bulletins historiques). Les primes correspondent aux primes réellement enregistrées sur le mois.',
  },
  en: {
    subject: 'Payroll summary', title: '💼 Payroll summary', greeting: 'Hello',
    intro: 'Here is the payroll summary for your shop',
    headcount: 'Active headcount', payroll: 'Payroll', projected: 'projection — current headcount',
    bonuses: 'Bonuses paid during the month', total: 'Estimated total',
    note: 'Payroll is a projection based on the current headcount (HabaShop does not store historical payslips). Bonuses reflect the bonuses actually recorded during the month.',
  },
  es: {
    subject: 'Resumen de nómina', title: '💼 Resumen de nómina', greeting: 'Hola',
    intro: 'Aquí está el resumen de nómina de tu tienda',
    headcount: 'Plantilla activa', payroll: 'Masa salarial', projected: 'proyección — plantilla actual',
    bonuses: 'Primas pagadas en el mes', total: 'Total estimado',
    note: 'La masa salarial es una proyección basada en la plantilla actual (HabaShop no almacena nóminas históricas). Las primas reflejan las primas realmente registradas en el mes.',
  },
  it: {
    subject: 'Riepilogo stipendi', title: '💼 Riepilogo stipendi', greeting: 'Ciao',
    intro: 'Ecco il riepilogo degli stipendi del tuo negozio',
    headcount: 'Organico attivo', payroll: 'Massa salariale', projected: 'proiezione — organico attuale',
    bonuses: 'Premi erogati nel mese', total: 'Totale stimato',
    note: 'La massa salariale è una proiezione basata sull’organico attuale (HabaShop non conserva buste paga storiche). I premi riflettono i premi effettivamente registrati nel mese.',
  },
}

export async function sendPayrollSummaryEmail(opts: {
  /** Boutique émettrice — soumet l'envoi au garde de dépense (démo/essai/quota). */
  tenantId: string
  to: string; shopName: string; ownerName: string
  lang: string; currency: string; month: string // 'YYYY-MM'
  headcount: number; payroll: number; bonuses: number
}): Promise<boolean> {
  const L = PAYROLL_I18N[(opts.lang as L4)] ?? PAYROLL_I18N.fr
  const locale = opts.lang === 'en' ? 'en-US' : opts.lang === 'es' ? 'es-ES' : opts.lang === 'it' ? 'it-IT' : 'fr-FR'
  const money = (n: number) => `${new Intl.NumberFormat(locale).format(Math.round(n))} ${opts.currency}`
  const [y, m] = opts.month.split('-').map(Number)
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const total = opts.payroll + opts.bonuses
  const eShop = escHtml(opts.shopName)
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #EBEBF0;${strong ? 'font-weight:700;' : ''}">${label}</td>` +
    `<td style="padding:10px 12px;border-bottom:1px solid #EBEBF0;text-align:right;font-family:monospace;${strong ? 'font-weight:700;' : ''}">${value}</td></tr>`

  const html = baseTemplate(`
    <h2 style="margin:0 0 6px;color:#1A1A2E;">${L.title} — ${escHtml(monthName)}</h2>
    <p style="color:#555;">${L.greeting} ${escHtml(opts.ownerName)},</p>
    <p style="color:#555;">${L.intro} <strong>${eShop}</strong> :</p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0;background:#FAFAFE;border-radius:10px;overflow:hidden;">
      ${row(L.headcount, String(opts.headcount))}
      ${row(`${L.payroll} <em style="color:#888;font-style:italic;">(${L.projected})</em>`, money(opts.payroll))}
      ${row(L.bonuses, money(opts.bonuses))}
      ${row(L.total, money(total), true)}
    </table>
    <p style="font-size:12px;color:#999;line-height:1.5;">${L.note}</p>
  `)
  return send({
    tenantId: opts.tenantId, to: opts.to, subject: `${L.subject} ${eShop} — ${monthName}`, html })
}
