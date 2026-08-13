import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseDescription, normalizeModule, CATEGORIES_MODULE } from '@/pages/Activity'

/**
 * VERROU — le journal d'audit MONTRE ce qu'il a enregistré, et ne promet rien de faux.
 *
 * Deux défauts mesurés le 2026-08-13, sur le même écran :
 *  (a) `PATCH /api/tenant` stocke `{ currency: { avant, apres }, … }` — et l'écran
 *      jetait ce détail, faute d'y chercher la bonne forme. Cinq lignes « Tenant Locale
 *      Change » rigoureusement indistinguables, alors que la base savait tout.
 *  (b) le KPI « Total événements » affichait `items.length` d'une route plafonnée à 100,
 *      sous un sous-titre annonçant une traçabilité « complète ».
 *
 * ⚠️ (b) était INVISIBLE : le tenant de démonstration compte dix événements. Comme le
 * camembert calé sur six catégories, une démonstration sous le seuil ne démontre rien.
 */

const ACTIVITY = readFileSync(join(__dirname, '..', 'pages', 'Activity.tsx'), 'utf8')

describe('(a) le changement avant→après est RENDU', () => {
  it('un changement de locale devient lisible', () => {
    const brut = JSON.stringify({
      currency: { avant: 'XOF', apres: 'XAF' },
      vatRate: { avant: 18, apres: 19.25 },
    })
    const rendu = parseDescription(brut, 'TENANT_LOCALE_CHANGE')
    expect(rendu).toContain('currency XOF → XAF')
    expect(rendu).toContain('vatRate 18 → 19.25')
  })

  it('⚠️ une valeur ABSENTE se dit « — », jamais par un vide', () => {
    // « country  → CM » se lirait comme un bogue d'affichage, alors que c'est un champ
    // qui n'existait pas encore. L'absence se DIT — même famille que `ratingSummary`.
    const rendu = parseDescription(JSON.stringify({ country: { avant: null, apres: 'CM' } }), 'X')
    expect(rendu).toBe('country — → CM')
  })

  it('les formes CONNUES restent servies — la règle n’a rien perdu au passage', () => {
    expect(parseDescription(JSON.stringify({ name: 'Awa' }), 'DELETE_USER')).toBe('Awa')
    expect(parseDescription(JSON.stringify({ email: 'a@b.c' }), 'X')).toBe('a@b.c')
    expect(parseDescription('texte libre', 'X')).toBe('texte libre')
    expect(parseDescription('DELETE_USER', 'DELETE_USER')).toBe('')   // pas de doublon
    expect(parseDescription(undefined, 'X')).toBe('')
    expect(parseDescription('{cassé', 'X')).toBe('')                  // JSON invalide
  })

  it('⚠️ un JSON quelconque n’est PAS déversé à l’écran', () => {
    // Déverser l'objet entier ferait entrer tout ce qu'un futur appelant y mettrait,
    // données personnelles comprises — l'inverse de la règle qui limite cet audit à des
    // codes et des nombres. Seules DEUX formes sont rendues.
    expect(parseDescription(JSON.stringify({ secret: 'x', phone: '+237600000000' }), 'X')).toBe('')
  })
})

describe('(c) les compteurs sont EXACTS, et nommés d’après ce qu’ils comptent', () => {
  it('aucun KPI n’est plus dérivé des lignes chargées', () => {
    // ⚠️ Ils portaient sur les ≤100 entrées reçues : « Alertes sécurité » ratait toute
    // alerte plus ancienne que la 100ᵉ ligne. Un compteur d'alertes qui rate les
    // alertes est PIRE que pas de compteur — on s'y fie.
    for (const derive of ['activityLog.filter(l => l.severity', 'new Set(activityLog.map']) {
      expect(ACTIVITY.includes(derive)).toBe(false)
    }
    expect(ACTIVITY).toContain('stats?.alertes')
    expect(ACTIVITY).toContain('stats?.aujourdhui')
    // ⚠️ « Modules concernés » ne vient plus du serveur : il compte les OPTIONS
    // réellement proposées juste à côté. Le serveur comptait les codes STOCKÉS, donc
    // `orders` + `suppliers` faisaient « 2 modules » en face d'UNE seule option
    // « Commandes » — deux nombres muets qui se contredisent sur le même écran.
    expect(ACTIVITY).toContain('optionsModules?.length')
    expect(ACTIVITY.includes('stats?.modules')).toBe(false)
  })

  it('⚠️ ZÉRO alerte n’est pas peint en ROUGE — l’œil croit la couleur avant le chiffre', () => {
    const ligne = ACTIVITY.split('\n').find(l => l.includes('stats.alertes > 0')) ?? ''
    expect(ligne, 'la couleur doit dépendre du compte').not.toBe('')
    expect(ligne).toContain('var(--danger)')
    expect(ligne).toContain('var(--text3)')
  })

  it('« Modules actifs » ne promet plus une activité que rien ne mesure', () => {
    // Le chiffre compte les modules AYANT PRODUIT un événement — parfois il y a des
    // mois. Le nom suit ce que le chiffre dit, dans les QUATRE langues.
    const I18N = readFileSync(join(__dirname, '..', 'i18n', 'index.ts'), 'utf8')
    for (const promesse of ['Modules actifs', 'Active modules', 'Módulos activos', 'Moduli attivi']) {
      expect(I18N.includes(promesse)).toBe(false)
    }
    expect((I18N.match(/activity_modules:/g) ?? []).length).toBe(4)
  })

  it('le filtre de sévérité dit ce qu’il filtre', () => {
    // « Toutes » ne disait pas toutes QUOI — trois filtres côte à côte, dont un sans
    // objet nommé, y compris pour un lecteur d'écran.
    expect(ACTIVITY).toContain("aria-label={i('Sévérité'")
    expect(ACTIVITY).toContain('Toutes sévérités')
  })
})

describe('(b) le total est celui du SERVEUR, et la troncature se dit', () => {
  it('l’écran ne dérive plus le total des lignes reçues', () => {
    // ⚠️ Règle de FORME : `activityLog.length` sous l'étiquette « total » est
    // exactement le défaut corrigé. Il reste légitime AILLEURS (le compte de lignes
    // affichées), d'où une recherche sur la ligne du KPI, pas sur le fichier.
    const ligneKpi = ACTIVITY.split('\n').find(l => l.includes("t('activity_total')")) ?? ''
    expect(ligneKpi, 'le KPI total doit exister').not.toBe('')
    expect(ligneKpi).toContain('totalServeur')
    expect(ligneKpi).not.toContain('activityLog.length')
  })

  it('⚠️ un total INCONNU ne s’invente pas — « … », jamais 0', () => {
    // `?? 0` afficherait « 0 événement » sur un journal qui n'a pas encore répondu :
    // un chiffre faux se retient, un tiret se lit.
    const ligneKpi = ACTIVITY.split('\n').find(l => l.includes("t('activity_total')")) ?? ''
    expect(/totalServeur\s*\?\?\s*0/.test(ligneKpi)).toBe(false)
  })

  it('la promesse de traçabilité « complète » a disparu', () => {
    // Elle était fausse deux fois : la route plafonne, et toutes les actions n'écrivent
    // pas d'audit. Une promesse d'exhaustivité fait cesser de chercher ailleurs.
    for (const promesse of ['Traçabilité complète', 'Complete audit trail']) {
      expect(ACTIVITY.includes(promesse)).toBe(false)
    }
  })

  it('⚠️ un ÉCHEC de lecture n’est pas rendu comme un journal VIDE', () => {
    // La route REMONTE volontairement son erreur (« un journal d'audit muet est pire
    // qu'un journal indisponible, parce qu'on le croit ») — et l'écran l'avalait dans
    // un `.catch(() => {})`, donc l'affichait comme « il ne s'est rien passé ».
    // Le garde serveur faisait son travail, l'affichage le défaisait.
    expect(/\.catch\(\(\) => \{\}\)/.test(ACTIVITY), 'plus aucun catch muet').toBe(false)
    expect(ACTIVITY).toContain('setEchec(true)')
    expect(ACTIVITY).toContain('if (echec) return')
  })

  it('le filtre de module est DÉRIVÉ des données, jamais d’un catalogue figé', () => {
    // ⚠️ Il listait `Object.keys(MODULE_CONFIG)` : neuf catégories écrites à la main,
    // dont trois qui ne pouvaient RIEN rendre. Une option morte est pire qu'une option
    // absente — son résultat vide se lit « il ne s'est rien passé ».
    expect(ACTIVITY.includes('Object.keys(MODULE_CONFIG).map')).toBe(false)
    expect(ACTIVITY).toContain('(optionsModules ?? []).map')
    expect(ACTIVITY).toContain('modulesPresents.map(normalizeModule)')
    // Dédoublonnage APRÈS normalisation, sinon deux codes d'une même catégorie
    // produiraient deux options identiques.
    expect(/new Set\(modulesPresents\.map\(normalizeModule\)\)/.test(ACTIVITY)).toBe(true)
  })

  it('le plafond n’est PAS recopié dans l’écran — il vit dans la route', () => {
    // Un « 100 » réécrit ici se périmerait au premier changement côté serveur, et la
    // divergence serait muette. La troncature se déduit de la comparaison au total.
    expect(/tronque\s*=\s*totalServeur !== null && totalServeur > activityLog\.length/.test(ACTIVITY)).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   (d) LE FILTRE NE PROMET QUE CE QUE LA DONNÉE PORTE
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ PÉRIMÈTRE DÉRIVÉ DU SERVEUR, jamais recopié ici. Une liste de modules écrite à
 * la main dans ce test se périmerait au premier module ajouté côté backend — et en
 * SILENCE, puisque le seul symptôme visible est un filtre qui ne rend rien.
 *
 * ⚠️ Lecture à l'EXÉCUTION (`readFileSync`), jamais un `import` : c'est la convention
 * des fixtures partagées de ce dépôt. Ici elle n'est pas dictée par le contexte
 * Docker (ce test tourne côté front) mais elle évite d'attirer `apps/backend` dans le
 * graphe de compilation du front, ce que `tsc` refuserait.
 */
const BACKEND_SRC = join(__dirname, '..', '..', '..', 'backend', 'src')

function fichiersTs(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests' && e !== 'node_modules') out.push(...fichiersTs(p)) }
    else if (e.endsWith('.ts') && !e.includes('.test.')) out.push(p)
  }
  return out
}

const FICHIERS_BACKEND = fichiersTs(BACKEND_SRC)

const MODULES_ECRITS: string[] = (() => {
  const vus = new Set<string>()
  for (const f of FICHIERS_BACKEND) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bmodule:\s*['"]([^'"]+)['"]/g)) vus.add(m[1])
  }
  return [...vus].sort()
})()

describe('(d) chaque module écrit par le SERVEUR a une catégorie à l’écran', () => {
  it('COUVERTURE — le balayage lit vraiment le backend, et lit les bons fichiers', () => {
    // ⚠️ Sans ce contrôle, un `readdirSync` sur un chemin déplacé rendrait une liste
    // VIDE, et la règle suivante passerait au vert en ne gardant rien : c'est l'angle
    // mort de PROFONDEUR, celui qui ne se signale jamais tout seul.
    expect(MODULES_ECRITS.length).toBeGreaterThanOrEqual(10)

    // TÉMOIN POSITIF, dans la même invocation : `SETTINGS` est écrit par
    // `routes/tenant.ts` et `routes/expenseBudgets.ts`. S'il manque, le motif de
    // recherche est faux — pas le code.
    expect(MODULES_ECRITS).toContain('SETTINGS')
    expect(MODULES_ECRITS).toContain('payroll')

    // DISCRIMINANT — on lit bien le BACKEND, pas un répertoire qui lui ressemble.
    // Le périmètre s'assert par un fichier qu'on sait y vivre, jamais par l'ABSENCE
    // d'une valeur : un `not.toContain('STOCK')` aurait paru plus fin, mais rien
    // n'interdit au serveur d'écrire un jour `module: 'STOCK'` — le verrou serait
    // alors devenu un frein à un changement légitime, exactement comme le test qui
    // exigeait « Sénégal » en dur. On épingle le PÉRIMÈTRE, pas le contenu.
    expect(FICHIERS_BACKEND.some(f => f.endsWith(join('routes', 'analytics.ts')))).toBe(true)
    expect(FICHIERS_BACKEND.some(f => f.endsWith(join('routes', 'tenant.ts')))).toBe(true)
  })

  it('aucun module écrit n’est ORPHELIN de catégorie', () => {
    // ⚠️ LE DÉFAUT MESURÉ le 2026-08-14. `SETTINGS`, `payroll`, `GOALS` et
    // `account_deletion` n'avaient aucune entrée : la clé retombait sur elle-même,
    // l'option de filtre valait `PARAMÈTRES`, et l'égalité stricte n'arrivait jamais.
    // Filtrer « Paramètres » rendait ZÉRO ligne sur un journal composé à 80 % de
    // `SETTINGS` — et le badge affichait le code brut à l'écran.
    const orphelins = MODULES_ECRITS.filter(code => !CATEGORIES_MODULE.includes(normalizeModule(code)))
    expect(orphelins).toEqual([])
  })

  it('la normalisation est INSENSIBLE à la casse choisie côté serveur', () => {
    // Le backend écrit indifféremment `products` et `USERS` — deux conventions dans
    // la même table. Une correspondance qui n'en couvre qu'une laisse l'autre orpheline.
    expect(normalizeModule('SETTINGS')).toBe(normalizeModule('settings'))
    expect(normalizeModule('payroll')).toBe(normalizeModule('PAYROLL'))
    expect(normalizeModule('orders')).toBe(normalizeModule('suppliers'))   // même catégorie
  })

  it('⚠️ un module INCONNU reste VISIBLE, il ne se fond pas dans « Paramètres »', () => {
    // Le ranger d'office sous une catégorie existante le rendrait introuvable : on
    // filtrerait « Paramètres » et on tomberait sur des lignes qui n'en sont pas.
    // Une valeur inconnue est neutre et visible — jamais assimilée.
    expect(normalizeModule('un_module_futur')).toBe('UN_MODULE_FUTUR')
    // Seule une ABSENCE de module retombe sur un repli, faute de mieux à afficher.
    expect(normalizeModule('')).toBe('PARAMÈTRES')
    expect(normalizeModule(null)).toBe('PARAMÈTRES')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   (e) LA SÉCURITÉ DU COMPTE EST RENDUE — elle était écrite, lisible, et invisible
   ══════════════════════════════════════════════════════════════════════════════ */

describe('(e) le panneau « Sécurité de mon compte »', () => {
  it('appelle la route du COMPTE — la surface n’est plus morte', () => {
    // ⚠️ `GET /api/account/security-activity` existait côté serveur ET
    // `accountApi.securityActivity` côté client : AUCUN écran ne l'appelait. Un
    // changement de mot de passe était donc écrit, lisible par API, et affiché nulle
    // part — pendant que le filtre proposait « Auth », qui ne pouvait rien rendre
    // puisque la route du journal ne lit que `auditLog`.
    expect(ACTIVITY).toContain('accountApi.securityActivity()')
  })

  it('⚠️ N’EST PAS fondu dans le journal de la boutique', () => {
    // `UserAuditLog` n'a pas de `tenantId` (le schéma l'interdit) et la route ne rend
    // que les événements de l'appelant : fusionné, l'écran deviendrait DIFFÉRENT selon
    // qui le regarde, et le CSV exporté ne serait celui de personne.
    expect(ACTIVITY.includes('setActivityLog(secuEvents')).toBe(false)
    expect(/secuEvents\s*\.\s*concat|\.\.\.secuEvents/.test(ACTIVITY)).toBe(false)
    // Le titre porte l'ÉCHELLE : sans lui, un admin croirait voir la sécurité de
    // toute la boutique.
    expect(ACTIVITY).toContain('Sécurité de mon compte')
  })

  it('⚠️ TROIS états — un échec de lecture ne se rend pas comme « aucun événement »', () => {
    // Sur un panneau de sécurité, une liste vide qui veut dire « on n'a pas pu lire »
    // affirme qu'il ne s'est rien passé sur le compte. Même règle que le journal.
    expect(ACTIVITY).toContain('setSecuEchec(true)')
    expect(ACTIVITY).toContain('secuEchec ?')
    expect(ACTIVITY).toContain('secuEvents === null')
    expect(ACTIVITY).toContain('secuEvents.length === 0')
  })

  it('l’action du serveur est LIBELLÉE, dans les quatre langues', () => {
    // ⚠️ Le serveur écrit `PASSWORD_CHANGE` ; le front ne connaissait que
    // `CHANGE_PASSWORD` — les deux mots dans l'autre ordre, jamais écrits par
    // personne. Le repli rendait « Password Change », en anglais, quelle que soit la
    // langue de l'écran.
    expect(ACTIVITY).toContain('PASSWORD_CHANGE:')
    for (const l of ['fr', 'en', 'es', 'it']) {
      expect(actionLabelDepuisSource('PASSWORD_CHANGE', l)).not.toMatch(/^Password Change$/)
    }
  })
})

/** Lit le libellé tel qu'écrit dans le source — `actionLabel` n'est pas exporté, et
 *  l'exporter pour un test élargirait la surface publique du module pour rien. */
function actionLabelDepuisSource(action: string, lang: string): string {
  const ligne = ACTIVITY.split('\n').find(l => l.trimStart().startsWith(`${action}:`) && l.includes('['))
  if (!ligne) throw new Error(`${action} absent d'ACTION_LABELS — le libellé retomberait sur le repli anglais`)
  const quatre = [...ligne.matchAll(/'([^']*)'/g)].map(m => m[1])
  if (quatre.length !== 4) throw new Error(`${action} n'a pas ses 4 langues (${quatre.length})`)
  return quatre[lang === 'en' ? 1 : lang === 'es' ? 2 : lang === 'it' ? 3 : 0]
}
