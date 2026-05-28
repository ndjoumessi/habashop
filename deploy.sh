#!/usr/bin/env bash
# deploy.sh — Déploiement frontend HabaShop sur Vercel (prod)
# Usage : ./deploy.sh ["message de commit optionnel"]
# S'arrête à la première erreur.
set -euo pipefail

# --- Couleurs pour la lisibilité ---
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
step() { echo -e "\n${Y}━━━ $1 ━━━${N}"; }
ok()   { echo -e "${G}✓ $1${N}"; }
die()  { echo -e "${R}✗ $1${N}"; exit 1; }

# --- Aller à la racine du projet (dossier du script) ---
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- Node 20 obligatoire ---
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
NODE_V="$(node -v 2>/dev/null || echo 'absent')"
echo "Node : $NODE_V"
case "$NODE_V" in
  v20.*) ok "Node 20 OK" ;;
  *) die "Node 20.20.2 attendu, trouvé $NODE_V. Vérifie nvm." ;;
esac

FRONT="$ROOT/apps/frontend"
[ -d "$FRONT" ] || die "Dossier apps/frontend introuvable"

# --- 1. Commit éventuel des changements en cours ---
step "1/5 — État Git"
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-chore: déploiement frontend}"
  echo "Changements détectés, commit avec le message : \"$MSG\""
  git add -A
  git commit -m "$MSG"
  ok "Commit créé"
else
  ok "Aucun changement non commité"
fi

# --- 2. tsc ---
step "2/5 — Vérification TypeScript (tsc --noEmit)"
cd "$FRONT"
npx tsc --noEmit || die "tsc a échoué — déploiement annulé"
ok "tsc 0 erreur"

# --- 3. Build ---
step "3/5 — Build de production (vite)"
npm run build || die "Build échoué — déploiement annulé"
HASH="$(ls -1 dist/assets/ | grep -E '^index-.*\.js$' | head -1)"
ok "Build OK — bundle : ${HASH:-inconnu}"

# --- 4. Push GitHub ---
step "4/5 — Push sur origin/main"
cd "$ROOT"
git push origin main || die "git push a échoué"
ok "Push GitHub OK"

# --- 5. Déploiement Vercel prod ---
step "5/5 — Déploiement Vercel (prod) depuis apps/frontend"
cd "$FRONT"
npx vercel --prod --yes || die "Déploiement Vercel échoué"

echo -e "\n${G}════════════════════════════════════════${N}"
echo -e "${G} DÉPLOIEMENT TERMINÉ${N}"
echo -e "${G}════════════════════════════════════════${N}"
echo "Bundle déployé : ${HASH:-inconnu}"
echo "Prod : https://habashop.vercel.app"
echo ""
echo -e "${Y}Rappel : hard reload (Cmd+Shift+R) côté navigateur,${N}"
echo -e "${Y}et vérifie le hash du bundle dans la console si besoin :${N}"
echo "  [...document.scripts].map(s=>s.src).filter(s=>s.includes('/assets/')).map(s=>s.split('/').pop())"
