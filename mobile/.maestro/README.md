# Smoke test Maestro — HabaShop Mobile

Smoke E2E du **parcours critique** : `login → Caisse → vente → remboursement`.

Pourquoi : ce parcours exerce le **rendu réel de la Caisse** (modales POS empilées).
Il aurait attrapé le crash **Fabric release-only** `addViewAt: failed to insert view`
dès le départ — un crash **invisible aux tests unitaires** (qui ne couvrent que la
logique pure : pricing, TVA, stock, conversion devise, idempotence…).

## Prérequis

- **Un device Android branché en USB** (débogage activé) **ou un émulateur actif**.
  - Vérifier : `adb devices` doit lister un device.
- L'app **HabaShop installée** sur ce device (build `preview`/`production` ou dev-client) :
  - Package Android : **`com.habashop.app`**.
  - Installer un APK : `adb install -r HabaShop-Mobile.apk`.
- **Réseau** : le flow se connecte à l'API prod (login + vente + remboursement réels).
- Java 17+ (requis par Maestro).

## Installation de Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
# puis recharger le PATH (le script ajoute ~/.maestro/bin)
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version   # vérifie l'installation
```

## Lancer le smoke

```bash
maestro test .maestro/smoke.yaml
```

## Debug (capture écrans + hiérarchie de vues à chaque étape)

```bash
maestro test --debug-output ./maestro-debug .maestro/smoke.yaml
# Inspecter la hiérarchie de vues en direct (pour trouver/ajuster un label) :
maestro studio
```

## Ce que fait le flow (`smoke.yaml`)

1. **Login** — `launchApp { clearState: true }`, chip démo **« Admin »** (préremplit
   `admin@habashop.com` / `demo1234`), bouton **« Se connecter »**, ferme la modale
   biométrie si présente, attend l'onglet **« Accueil »**.
2. **Vente** — onglet **« Caisse »** → tape la 1re tuile produit (prix en **€**, devise
   du tenant démo) → **« Encaisser »** (barre) → **« Encaisser <montant> € »** (panier)
   → **« Valider »** → assert **« Vente enregistrée »** → **« Non merci »**.
3. **Remboursement** — **« Retour »** → **« Historique »** → pill **« Rembourser »** de
   la vente la plus récente → assert **« Rembourser la vente »** → champ **« Motif du
   remboursement »** → **« Confirmer »** → assert **« Vente remboursée »**.

## Notes de maintenance

- **Labels** : tous les libellés sont en **français** (langue par défaut). L'i18n est
  inline (`i('fr','en','es','it')`), il n'y a pas de fichier de traduction ; si un
  libellé change dans le code, mettre à jour `smoke.yaml`.
- **Devise** : le tenant démo `admin@habashop.com` est en **EUR** → les prix affichent
  « € » (matcher de tuile produit). Si la devise change, adapter le sélecteur `"€"`.
- **« Se connecter »** apparaît 2× (titre de carte + bouton) → on cible `index: 1`.
- **Remboursement** : la pill « Rembourser » n'est visible que pour les rôles
  MANAGER/ADMIN/SUPER_ADMIN — le compte démo « Admin » est SUPER_ADMIN. ✅
- Le flow modifie des **données prod** (crée une vente puis la rembourse). Le
  remboursement est idempotent côté backend ; la vente reste tracée (status `refunded`).
