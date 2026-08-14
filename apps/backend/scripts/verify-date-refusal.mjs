// L'API DÉPLOYÉE refuse une date invalide en 400, et n'écrit RIEN.
//
// ─── QUAND LE LANCER — ET SURTOUT QUAND NE PAS ────────────────────────────────
// ⚠️ PAS après chaque déploiement. Cette consigne a existé une heure, le 2026-08-14,
// avant d'être resserrée : elle ne payait pas. Une régression de CODE est déjà prise
// AVANT le déploiement par `dateSchemas.test.ts`, qui monte les vraies routes avec le
// vrai compilateur zod et tourne à chaque push — sabotage vérifié, 6 rouges au retour
// de `z.any()`. Doubler ce garde par dix requêtes contre une boutique réelle à chaque
// mise en ligne, c'est du coût sans rendement ; et une consigne qu'on applique sans
// raison finit par ne plus être appliquée du tout.
//
// À LANCER quand la SOURCE peut rester juste pendant que l'EXÉCUTION change :
//   · montée de `zod`, `fastify`, ou `fastify-type-provider-zod` ;
//   · changement du `Dockerfile` ou de l'image de base ;
//   · doute ponctuel sur ce que la production fait vraiment (son usage d'origine :
//     prouver, le compte avant/après à l'appui, que le correctif était bien vivant).
//
// ⚠️ CE N'EST PAS un `verify:sw-routes` ni un `verify:classes`. Ceux-là inspectent un
// ARTEFACT transformé, où la source juste et le livré nul coexistent couramment. Ici
// il n'y a AUCUNE transformation entre la source et l'exécution : un schéma zod est du
// TypeScript compilé en JS, et le lockfile est commité. C'est ce qui rend le rendement
// faible — le dire évite qu'on le range par erreur parmi les gardes d'artefact.
//
// ─── CE QU'IL N'ÉCRIT PAS, ET COMMENT C'EST GARANTI ───────────────────────────
// ⚠️ Toutes les valeurs sondées sont des valeurs que le schéma REFUSE. Une date VALIDE
// créerait une dépense sur une boutique réelle — une mutation d'un tenant existant,
// interdite, et qu'une suppression après coup ne rendrait pas acceptable.
// La garde n'est PAS un commentaire : le script échoue si une sonde reçoit autre chose
// qu'un 400, ET il relève le nombre de dépenses AVANT et APRÈS. Un 400 dit que l'appel
// a été rejeté ; seul le compte dit que la base n'a pas bougé.
//
// ─── MANUEL, ET PAS EN CI — dit explicitement ─────────────────────────────────
// ⚠️ Ce script exige des identifiants, or le dépôt n'a AUCUN secret : il ne peut donc
// pas tourner en CI. Le brancher quand même produirait un job qui s'ignore ou qui
// échoue toujours — c'est exactement le `notify-failure` qui sortait en `exit 0` sur
// une configuration absente, et s'affichait VERT. On préfère un outil manuel assumé à
// une garde qui ne peut pas garder.
//
// Usage :
//   VERIFY_EMAIL=… VERIFY_PASSWORD=… npm run verify:date-refusal --workspace=apps/backend
//
// Les identifiants ne sont PAS écrits ici, même ceux de la démonstration : un mot de
// passe dans un fichier suivi par git est un mot de passe qu'on oublie d'en sortir.

const BASE  = process.env.VERIFY_BASE || 'https://habashop-production.up.railway.app'
const EMAIL = process.env.VERIFY_EMAIL
const MDP   = process.env.VERIFY_PASSWORD

if (!EMAIL || !MDP) {
  console.error('[dates] ÉCHEC : VERIFY_EMAIL et VERIFY_PASSWORD sont requis.')
  console.error('[dates] Ce script parle à l’API DÉPLOYÉE ; sans identifiants il ne mesure rien.')
  process.exit(1)
}

/**
 * ⚠️ CHAQUE VALEUR DOIT ÊTRE REFUSÉE PAR LE SCHÉMA. Ne rien ajouter ici sans le
 * vérifier : une date valide ferait de ce script une écriture sur une boutique réelle.
 * `new Date(x)` réussit sur tout ce qui suit et rend le 1er janvier 1970 — c'est
 * précisément ce qu'on empêche.
 */
const SONDES = [
  { date: 42.5,            pourquoi: 'nombre → epoch 42,5 ms → 1970' },
  { date: 0,               pourquoi: 'zéro → epoch 0 → 1970' },
  { date: null,            pourquoi: 'null → epoch 0 → 1970, sur une colonne NOT NULL' },
  { date: true,            pourquoi: 'booléen → epoch 1 ms → 1970' },
  { date: 'pas une date',  pourquoi: 'chaîne illisible → Invalid Date' },
  { date: '',              pourquoi: 'chaîne vide → Invalid Date' },
  { date: '2026-13-45',    pourquoi: 'date impossible → Invalid Date' },
]

const echec = (msg) => { console.error(`[dates] ÉCHEC : ${msg}`); process.exit(1) }

/** Le statut ATTENDU, nommé une seule fois : écrit en dur dans le message, il a
 *  produit « → 400, attendu 400 » sous sabotage — un diagnostic qui envoie chercher
 *  au mauvais endroit. Un message doit dériver de la condition qu'il commente. */
const ATTENDU = 400

// ── Authentification ──
const rAuth = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: MDP }),
})
if (!rAuth.ok) echec(`connexion refusée (${rAuth.status}) — identifiants ou URL incorrects.`)
const auth = await rAuth.json().catch(() => ({}))
if (!auth.token) echec('connexion sans jeton — réponse inattendue de /api/auth/login.')

/**
 * ⚠️ UN COMPTE MULTI-BOUTIQUES N'A PAS DE BOUTIQUE ACTIVE À LA CONNEXION. `login` rend
 * alors un jeton SANS tenant (`signNoTenant`) et `activeTenantId: null` : l'écran
 * affiche le sélecteur, et toute route scopée échouerait. Sans ce basculement, le
 * script se serait cassé sur la lecture des dépenses — et un lecteur pressé aurait pu
 * lire cet échec comme un défaut de l'API.
 */
let token = auth.token
if (!auth.activeTenantId) {
  const cible = auth.tenants?.[0]?.id
  if (!cible) echec('aucune boutique rattachée à ce compte — rien à sonder.')
  const rSwitch = await fetch(`${BASE}/api/auth/switch-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenantId: cible }),
  })
  if (!rSwitch.ok) echec(`bascule vers la boutique ${cible} refusée (${rSwitch.status}).`)
  const s = await rSwitch.json().catch(() => ({}))
  if (!s.token) echec('bascule sans jeton — réponse inattendue de /api/auth/switch-tenant.')
  token = s.token
  console.log(`[dates] boutique active : ${s.tenant?.name ?? cible}`)
}

const entetes = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

const compterDepenses = async () => {
  const r = await fetch(`${BASE}/api/expenses`, { headers: entetes })
  if (!r.ok) echec(`lecture des dépenses impossible (${r.status}) — la preuve « rien n’a bougé » serait vide.`)
  const j = await r.json()
  if (!Array.isArray(j)) echec('la liste des dépenses n’est pas un tableau — contrat inattendu.')
  return j.length
}

const avant = await compterDepenses()
console.log(`[dates] ${BASE} — ${avant} dépense(s) avant la sonde`)

let refus = 0
for (const { date, pourquoi } of SONDES) {
  const r = await fetch(`${BASE}/api/expenses`, {
    method: 'POST',
    headers: entetes,
    // Libellé explicite : si une ligne apparaissait malgré tout, elle serait
    // immédiatement identifiable comme venant d'ici.
    body: JSON.stringify({
      date, label: 'SONDE-VERIFICATION-NE-DOIT-PAS-EXISTER',
      category: 'Autre', amountHT: 1, amountTTC: 1, mode: 'cash',
    }),
  })
  const corps = await r.json().catch(() => ({}))
  const etiquette = JSON.stringify(date)

  if (r.status === 500) {
    echec(`date=${etiquette} → 500. C'est EXACTEMENT le défaut corrigé : une saisie invalide `
        + `rendue comme une panne serveur. (${pourquoi})`)
  }
  if (r.status !== ATTENDU) {
    echec(`date=${etiquette} → ${r.status}, attendu ${ATTENDU}. Une valeur qui n'est plus refusée `
        + `peut avoir ÉCRIT une ligne : vérifier la boutique. (${pourquoi})`)
  }
  console.log(`[dates]   ${etiquette.padEnd(16)} → ${r.status} ${corps.code ?? ''} ${corps.error ?? ''}`)
  refus++
}

// ⚠️ COUVERTURE — DEUX assertions, et la seconde est celle qui manquait.
// `refus !== SONDES.length` ne dit RIEN sur une liste VIDE : la boucle ne tourne pas,
// et `0 !== 0` est faux, donc le script se déclarait vert en n'ayant rien sondé. C'est
// l'angle mort de PROFONDEUR, dans le garde lui-même. Le plancher est le vrai filet.
const PLANCHER = 5
if (SONDES.length < PLANCHER) echec(`${SONDES.length} sonde(s) déclarée(s), ${PLANCHER} au minimum attendues.`)
if (refus !== SONDES.length) echec(`${refus} sonde(s) exercée(s) sur ${SONDES.length} déclarée(s).`)

const apres = await compterDepenses()
if (apres !== avant) {
  echec(`la base A BOUGÉ : ${avant} → ${apres} dépense(s). Une sonde a écrit alors qu'aucune `
      + `ne le devait — retirer la ligne « SONDE-VERIFICATION-NE-DOIT-PAS-EXISTER ».`)
}

console.log(`[dates] OK — ${refus} valeurs refusées en ${ATTENDU}, aucun 500, ${avant} dépense(s) avant comme après.`)
