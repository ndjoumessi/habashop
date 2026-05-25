import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// FROM configurable via EMAIL_FROM. Par défaut on utilise onboarding@resend.dev
// qui fonctionne immédiatement avec n'importe quelle clé Resend (sans domaine vérifié).
const FROM = process.env.EMAIL_FROM || 'HabaShop <onboarding@resend.dev>'

// ── Helper d'envoi sécurisé ──────────────────
async function send(opts: {
  to:      string
  subject: string
  html:    string
  text?:   string
}): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY manquant — email non envoyé:', opts.subject)
    return false
  }
  try {
    await resend.emails.send({
      from:    FROM,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    })
    console.log('📧 Email envoyé:', opts.subject, '→', opts.to)
    return true
  } catch (err) {
    console.error('❌ Email échoué:', err)
    return false
  }
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
      <p class="header-logo">🛍️ HabaShop</p>
      <p class="header-sub">Gestion commerciale pour l'Afrique</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <div class="flag-row">🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇬🇳 🇨🇲</div>
      <p>© 2026 HabaShop · Logiciel SaaS pour commerces africains</p>
      <p>
        <a href="https://habashop.vercel.app">habashop.vercel.app</a> ·
        <a href="https://habashop.vercel.app/login">Se connecter</a>
      </p>
      <p style="font-size:11px;color:#AAAACC;margin-top:12px;">
        Vous recevez cet email car vous avez créé un compte HabaShop.
        <a href="https://habashop.vercel.app/unsubscribe">Se désabonner</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ════════════════════════════════════════════
// EMAIL 1 — Bienvenue après inscription
// ════════════════════════════════════════════
export async function sendWelcomeEmail(opts: {
  to:        string
  shopName:  string
  ownerName: string
  plan:      string
}): Promise<boolean> {
  const { to, shopName, ownerName } = opts
  const firstName = ownerName.split(' ')[0]
  const loginUrl  = 'https://habashop.vercel.app/login'

  const html = baseTemplate(`
    <h1>Bienvenue sur HabaShop, ${firstName} ! 🎉</h1>
    <p>Votre boutique <strong>${shopName}</strong> est prête.
    Vous bénéficiez d'un <strong>essai gratuit de 14 jours</strong>
    pour explorer toutes les fonctionnalités.</p>

    <div class="flag-row">🛍️</div>

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
  const upgradeUrl  = 'https://habashop.vercel.app/app/upgrade'

  const html = baseTemplate(`
    <h1>Plus que 7 jours d'essai, ${firstName}</h1>
    <p>Votre essai gratuit de <strong>${shopName}</strong>
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
  const upgradeUrl = 'https://habashop.vercel.app/app/upgrade'

  const html = baseTemplate(`
    <h1>🚨 Plus que 3 jours — ${firstName}</h1>
    <p>L'essai gratuit de <strong>${shopName}</strong>
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
  const loginUrl   = 'https://habashop.vercel.app/login'

  const methodLabels: Record<string,string> = {
    wave:         'Wave 🌊',
    orange_money: 'Orange Money 🟠',
    mtn_money:    'MTN Money',
    virement:     'Virement bancaire',
    card:         'Carte bancaire',
  }

  const html = baseTemplate(`
    <h1>✅ Votre plan ${planLabel} est activé !</h1>
    <p>Félicitations ${firstName} ! Votre boutique
    <strong>${shopName}</strong> est maintenant sur le plan
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

    ${ref ? `<p style="font-size:12px;color:#8888A8;">Référence de paiement : <code>${ref}</code></p>` : ''}

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
  const upgradeUrl = 'https://habashop.vercel.app/app/upgrade'

  const html = baseTemplate(`
    <h1>Votre essai a expiré, ${firstName}</h1>
    <p>L'essai gratuit de <strong>${shopName}</strong> est terminé.
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

// ════════════════════════════════════════════
// EMAIL 6 — Rapport hebdomadaire
// ════════════════════════════════════════════
export async function sendWeeklyReport(opts: {
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
  const dashUrl = 'https://habashop.vercel.app/app/dashboard'

  const html = baseTemplate(`
    <h1>📊 Rapport de la semaine — ${shopName}</h1>
    <p>Bonjour ${firstName}, voici le bilan de la semaine
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
    to,
    subject: `📊 ${shopName} — Bilan semaine : ${caWeek.toLocaleString('fr-FR')} F CFA (${evolLabel})`,
    html,
  })
}
