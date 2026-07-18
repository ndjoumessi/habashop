# Handoff — cohérence devise POS + refonte facture/devis (2026-07-18)

Stream terminé : tout mergé sur `main`, déployé et vérifié en prod. Working tree clean.
Ce doc oriente une reprise ; le détail vit dans les corps de PR (#41–#49).

## État final

`main` = `8f27b4aa`. Neuf PRs mergées + déployées ce jour, CI main verte à chaque merge
(Security, Unit back/front, Integration prod, E2E prod) :

| PR | Objet | Déploiement |
|----|-------|-------------|
| #41 | POS : cohérence devise (remise « F » → symbole dynamique, TVA via fmt) | Vercel |
| #42 | POS : raccourcis espèces adaptés à la devise (1000/5000 XOF vs 5/10/50 EUR) | Vercel |
| #43 | **P0** carte fidélité clic mort + audit UI/UX page Clients | Vercel |
| #44 | Clients : suffixe devise discret (`AmountCur`) | Vercel |
| #45 | chore lint : 0 erreur eslint (3 fichiers de tests) | — |
| #46 | **Facture/devis FRONTEND** (`utils/export.ts`) : séparateur U+202F + refonte | Vercel |
| #47 | Tenant : champs légaux `ninea/rccm/vatNumber` + Réglages « Infos légales » | Migration prod + Railway + Vercel |
| #48 | **Facture BACKEND** (`lib/invoicePdf.ts`, pdfkit) : séparateur + refonte | Railway |
| #49 | Facture/devis : masque « FACTURÉ À » si vente sans client | Railway + Vercel |

Tests : back **506** / front **354** (vitest). Corps de PR = détail complet, ne pas re-dériver.

## LE piège structurant (aussi dans CLAUDE.md § Facture PDF)

**DEUX générateurs de facture disjoints, tous deux vivants** — un fix doit toucher les DEUX :
- **`apps/backend/src/lib/invoicePdf.ts`** (pdfkit) = LA facture réelle. Bouton historique POS
  (`POSProductGrid.tsx`) → `salesApi.openInvoice` → `GET /api/sales/:id/invoice`.
  `ticketZ.ts` (Ticket Z PDF) réutilise son `fmtMoney`.
- **`apps/frontend/src/utils/export.ts` `generateInvoice`** = le devis (popup). Seul appelant UI :
  Clients → ⋯ → « Générer un devis PDF » (`CustomersList.tsx`), **qui passe TOUJOURS le client
  de la ligne** → un devis « sans client » n'y est pas atteignable.

Séparateur milliers : `toLocaleString('fr-FR')` produit U+202F (espace fine). En **monospace**
(Courier / Helvetica WinAnsi PDF), pas de glyphe → rendu « / » (« 8 /500 »). Helpers :
`printableAmount()` (frontend), `pdfSafeSpaces()` (backend) — U+202F/U+00A0 → espace simple.
Couvre aussi le PDF TVA (`reports.ts` fmt2).

## Prochaines actions probables (non traitées)

1. **Hygiène secrets** (hors périmètre code, action mainteneur) — cf. section dédiée du doc précédent.
2. Dette 🔴 CLAUDE.md : SMS Africa's Talking, Push PWA VAPID, `WAVE_WEBHOOK_SECRET`, go-live Campay/PayDunya.
3. Item 11 mobile (`mobile/` Expo) : jamais fait.
4. README.md public : obsolète.
5. Améliorations facture : logo depuis `tenant.logo` (aujourd'hui logo Sac+H générique), signatures, CGV.

## Pièges appris cette session (au-delà de CLAUDE.md)

- **Décider Railway vs Vercel** : `git show --stat <sha>` AVANT de conclure. Un fix qui touche
  `utils/export.ts` (frontend) exige Vercel, même s'il corrige aussi le backend. Vérifier qu'un fix
  front est live en prod : récupérer le chunk servi (`curl $BASE/` → chunks → grep) et inspecter le
  code minifié — plus fiable qu'une capture.
- **`vercel --prod` ne pose PAS de métadonnée git** (`vercel inspect --json` → `meta:{}`) : impossible
  de savoir quel commit un déploiement CLI contient. Pour certifier, redéployer depuis un HEAD connu
  (working tree propre) plutôt que se fier à un déploiement CLI antérieur ambigu.
- **U+202F/U+00A0 littéraux = erreurs eslint** (`no-irregular-whitespace`) : classes regex en
  échappements Unicode. Éditer un fichier contenant ces caractères → **script Python** (Edit ne matche
  pas les octets multi-byte de façon fiable).
- **PDF backend non grep-able** (buffer binaire compressé) : pour tester la présence/absence d'un
  texte, **mocker pdfkit** et capturer les appels `.text()` (cf. `invoiceBilledTo.test.ts`).
- **Rendu PDF → image sans dépendance** : `sips -s format png x.pdf --out x.png` (macOS natif).
- **Route `/api/tenant` n'a PAS de schéma zod** (liste blanche `TenantUpdateBody` + mapping explicite) :
  la validation des nouveaux champs vit dans le handler. `''` → `null` (convention `ownerPhone`).
- **`setTenant` doit refléter tout champ lu ailleurs** : la page Clients / la facture lisent
  `tenant.enableLoyalty` / `tenant.ninea`… → à la sauvegarde Réglages, `setTenant({...cur, <champs>})`
  sinon store périmé jusqu'au reload (cause du P0 fidélité #43).
- **Migration prod additive** : `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel`
  pour prévisualiser le SQL, puis `prisma db push` (sans data loss), puis re-diff (doit être vide).
- **Bug non couvert par des tests verts** (#48) : l'assertion figeait le bug (`'5 900 FCFA'` avec
  U+202F littérale). Leçon : une assertion sur une valeur formatée teste la sortie VOULUE, pas la
  sortie observée.

## Suggested skills

- `verify` — exercer le flux réel après toute modif (build `VITE_API_URL=<railway>` + `vite preview` +
  Playwright, ou dump PDF via vitest + `sips`).
- `code-review` — avant merge de gros diffs ; la revue sécu a déjà attrapé un XSS (`document.write`)
  → `escHtml()` systématique dans tout document imprimé.
- `diagnosing-bugs` — le bug « 8 /500 » venait du SECOND générateur non audité ; cartographier tous
  les chemins avant de conclure.
- `update-config` — automatiser (hooks) le rituel tsc/vitest/eslint pre-push si souhaité.

## Environnements (rappels)

Node 20 via nvm OBLIGATOIRE (défaut v10 casse tout). Comptes démo & tenant E2E : cf. CLAUDE.md.
Le tenant E2E a des ventes de passage (utile pour tester la facture sans client). Captures de
validation = `apps/frontend/e2e/screenshots/*` (gitignored, temporaires).
