# Déploiement et CI — les mesures derrière les règles

*Cette page porte les incidents, les mesures datées et les inférences corrigées. Les règles
qui en découlent vivent dans `CLAUDE.md` (§ Déploiement, § APRÈS UN MERGE, § L'ALARME QUI NE
PEUT PAS SONNER, § CI ROUGE ≠ CODE FAUTIF, § Vérification en PROD).*

**À lire avant** de « forcer » un déploiement, de relever un cliquet de lint, ou de diagnostiquer
une CI rouge.

---

## Pourquoi on ne force pas un déploiement

Mesuré le **2026-07-23** : la prod servait déjà la version neuve **17 s** après le push, alors
que le `railway up --ci` lancé « pour forcer » était encore en build ; il a produit un **second**
déploiement du même commit. **Le lag « ~20-25 min » qui justifiait le forçage n'a jamais été
observé.** Le geste manuel double le déploiement — deux redémarrages de conteneur au lieu d'un —
et brûle le quota Vercel (free-tier = 100 déploiements/jour).

## L'inférence « prod = manuelle » était FAUSSE

L'ancienne lecture s'appuyait sur la PR #49 : des déploiements prod sans métadonnée git, donc
« l'auto-deploy n'existe pas ». En réalité ces prod-là venaient bien du CLI **parce qu'on lançait
`vercel --prod` en plus**, pas parce que l'auto-deploy manquait ; et l'absence de prod après
certains merges venait du **QUOTA épuisé**, pas d'une config absente.

Vérifié le 2026-07-19 (Settings → Git) : **la production suit `main`**.

## Modèle de déploiement RÉEL — mesuré 2026-07-28 (12 déploiements, 5 merges, 5 PR)

| Événement | Effet | État |
|---|---|---|
| Push sur `main` | **1 déploiement prod** (auto, back Railway + front Vercel) | ✅ conforme, **zéro geste manuel** (5/5) |
| Push sur une branche **AVEC une PR** | **1 preview Vercel** — **PAR CONCEPTION** de l'intégration GitHub de Vercel, **indépendant** du branch tracking. Un **force-push** (rebase) en coûte **une de plus** | 7/7 portaient un `githubPrId` ; 2 des 5 PR en ont consommé 2 |
| Branche **SANS PR** | **0 preview** — « All unassigned branches » est bien désactivé | 0/12 branches orphelines n'a déployé |

⚠️ **Le réglage n'est PAS cassé — ne plus chercher un réglage à réparer.** L'ancienne cible
« 1 prod par merge, **zéro preview**, zéro geste manuel » était une **erreur de doc** : elle
confondait le **branch tracking** (désactivé, et qui tient) avec les **previews de PR** (créées
par conception). Aucun geste ne rend « zéro preview » atteignable par ce levier.

**Les previews de PR ont une VALEUR** : chaque build de PR prouve que le front **compile** avec
le changement — signal que la CI unitaire ne donne pas. Les supprimer coûterait cette garantie.

## Le cliquet de lint franchi — la comptabilité en deux colonnes

Le 2026-08-06, `da31e7a9` a fait passer le compte front de 209 à **210**, par une `() => {}`
vide dans un test qu'il ajoutait. La CI de `main` a échoué à l'étape « Lint » du job frontend
pendant **6 h et 5 commits**.

**UN CLIQUET CONTRAINT LA SOMME, PAS L'INTRODUCTION.** Le premier correctif l'a soldé en
supprimant deux imports morts (`CNSS_RATE`/`IR_RATE` dans `NewContractModal`) qui n'avaient rien
à voir : le chiffre redevenait juste, **la fonction vide restait**, et deux nettoyages légitimes
avaient été dépensés pour payer une dette qu'ils n'avaient pas creusée.

| | Δ | Plafond |
|---|---|---|
| état avant `da31e7a9` | — | **209** |
| régression introduite (`() => {}` vide, `integrationsRendered.test.tsx:94`) | +1 | 210 → **rouge** |
| ↳ **remboursée** : `new Promise<never>(() => { /* jamais résolue */ })` | −1 | retour à 209 |
| nettoyage **indépendant** : 2 imports morts de `NewContractModal` | −2 | **207** |

Solde net identique à un « −1 » global, mais les deux mouvements ne disent pas la même chose :
le premier répare, le second progresse. Confondus, on croit avoir nettoyé alors qu'on a
seulement remboursé.

*(Historique du cliquet backend : 333 → 327 au fil de l'item 10, → 325 en extrayant le handler
d'erreur, → 323 en typant l'export CSV par Prisma. Il était à 200 pour 333 avertissements réels,
parce que la CI ne lançait pas le lint et que l'échec passait inaperçu.)*

## L'alarme qui ne peut pas sonner — et qui se déclare VERTE

Ce n'est pas le cliquet franchi qui compte, c'est que l'échec soit **passé inaperçu 6 h et
5 commits**. Cause racine, mesurée le 2026-08-06 : le job `notify-failure` faisait

```bash
if [ -z "$DISCORD_WEBHOOK" ]; then echo "absent — skip"; exit 0; fi
```

et le dépôt n'a **AUCUN secret** (`gh api repos/…/actions/secrets` → `total_count: 0`). L'étape
sortait donc en 0, et la page du run affichait une **coche VERTE** à côté de « Notify on
failure » — sur un run rouge où personne n'avait été prévenu. Un fail-open **non tracé** rend
l'absence de canal indistinguable d'une alerte envoyée : c'est le motif « une pastille qui ne
peut pas rougir ne prouve rien » appliqué à la CI elle-même.

**Corrigé** : secret absent → `::error::` **+ `exit 1`**. Le job ne tourne que `if: failure()` —
le faire échouer ne rend aucun run vert rouge ; il rend seulement lisible, sur un run déjà rouge,
que l'alerte n'est pas partie.

Ajouté au passage :

- `--fail-with-body` sur le `curl` — sans lui, un webhook **révoqué** sortait en 0 sur un 404,
  aussi silencieux que le secret absent, pour la même raison ;
- les métadonnées passent par des variables `env:` + `jq` au lieu d'être interpolées dans le
  corps du `run:` (une branche portant un guillemet cassait le JSON, ou s'y injectait ; vérifié
  avec `main"; rm -rf /`, correctement échappé).

⚠️ **Le motif ne se répète PAS ailleurs — vérifié, pas supposé.** `DISCORD_WEBHOOK` est le
**seul** `secrets.*` de `ci.yml` et `pages.yml`, et l'unique `exit 0` sur secret absent. Les deux
`continue-on-error: true` (npm audit) sont d'une autre nature : **délibérés, nommés « non
bloquant », et l'étape reste visiblement en échec**. Ne pas les « corriger » par analogie.

## La panne GitHub Actions — deux causes superposées, deux diagnostics faux

Le 2026-08-06, `main` a porté **5 runs rouges**. Deux causes **indépendantes** s'y superposaient :

| Runs | Cause | Signe qui la distingue |
|---|---|---|
| 2 (`da31e7a9`, `2f510eb4`) | **notre code** — cliquet lint franchi | les étapes ont TOURNÉ, `Lint` en `failure` |
| 3 (`a5bfb27f`, `702bdf1a`, `9f967714`) | **panne GitHub Actions** | **0 étape exécutée**, annulation après **15 min pile** — aucun runner obtenu |

Incident réel : `Actions · critical`, ouvert **15h22 UTC** — soit **une minute avant** notre
dernier run complet. Ses formulations décrivent nos trois symptômes mot pour mot :
« *failing to start* » (runs créés, 0 étape), « *queued jobs may time out* » (les 15 min),
« *delayed in starting* » (deux pushs sans aucun run créé, sur **aucune branche**).

⚠️ **Ma piste « minutes Actions épuisées » était structurellement IMPOSSIBLE, et je l'ai proposée
sans vérifier une ligne de `gh api /repos/…`** : ce dépôt est **PUBLIC**, donc les minutes runner
standard y sont **gratuites et illimitées**. Une hypothèse qui envoie chercher dans la
facturation coûte le temps de quelqu'un d'autre — **vérifier la visibilité du dépôt AVANT de
suspecter un quota**.

## Les deux incidents qui ont produit la règle de vérification en PROD

Tous deux le **2026-07-22** :

1. Un « contrôle positif » sur `POST /api/whatsapp/send-ticket` a **réellement expédié** un
   message WhatsApp facturé vers le `ownerPhone` de la démo. L'endpoint choisi pour prouver
   qu'un garde laisse passer était… un endpoint qui envoie.
2. Un `PATCH /api/tenant` exploratoire a mis `enableAutoWhatsApp=true` sur `demo-tenant-001`
   (remis à `false` ensuite). Vérifier un garde ne justifie pas de modifier la configuration
   d'une boutique réelle.

Et le smoke de version est resté **vert alors que le déploiement n'avait pas eu lieu**, vu
**2 fois** : `railway up` avait échoué après « Failed to stream build logs », la version n'ayant
pas bougé, la comparaison passait.

## Le contexte Docker — l'incident

Vécu le **2026-08-05** (`#91be7af7`) : un `import` d'une fixture de `docs/` compilait en local et
cassait le déploiement Railway en **TS2307**. **Prod figée sur le commit précédent pendant
20 min.** La convention « fixture partagée lue à l'EXÉCUTION » était déjà celle des 7 autres
jumeaux (`csvInjection`, `payrollNetShared`, `barcodeShared`…), elle n'était juste écrite nulle
part.

⚠️ Le méta-test `dockerContextImports.test.ts` **s'est épinglé lui-même au premier tir** : sa
contre-preuve écrivait le motif en toutes lettres. *Un scanneur doit survivre à son propre scan.*

## Sonder un run rouge — les trois commandes

Dans cet ordre, et **jamais** en partant de la facturation (§ `CLAUDE.md` — sur un dépôt
PUBLIC les minutes runner sont gratuites et illimitées, la piste est structurellement
impossible) :

```bash
gh api repos/<o>/<r>/actions/runs/<id>/jobs \
  -q '.jobs[] | "\(.name) \(.conclusion) étapes=\(.steps|length)"'
gh api /repos/<o>/<r>/actions/workflows -q '.workflows[].state'   # active ≠ désactivé
curl -s https://www.githubstatus.com/api/v2/summary.json | jq '.components[]|select(.name=="Actions")'
```

Le discriminant est `steps.length`. Un job `cancelled` à **zéro étape** n'a rien jugé : il
n'a jamais obtenu de runner, et l'annulation tombe à 15 min pile. Un job dont les étapes ont
tourné accuse bien le code.

## Le job mobile — mesures d'installation

`unit-tests-mobile` (#163) fait son `npm ci` **dans** `mobile/`
(`cache-dependency-path: mobile/package-lock.json`) : `mobile/` a son propre lockfile et
n'est pas servi par le `npm ci` racine. Mesuré : install à froid **28 s**, suite **5 s**.
