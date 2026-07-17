# HabaShop — Specs UX (item 11) : POS · Fidélité · Onboarding

*Maquettes validées (thème NKONI + Geist). Ce doc consolide les partis-pris pour une implémentation fidèle. Screens : POS principal, Encaissement, Ticket Z, Carte fidélité, Onboarding.*

## 0. Règles globales (valables partout)

- **Tokens CSS uniquement** — jamais de hex en dur. Les couleurs des maquettes se mappent ainsi :

| Maquette (hex) | Token à utiliser | Rôle |
| --- | --- | --- |
| `#0A0C14` | `var(--bg)` | fond écran |
| `#121724` | `var(--card)` | carte |
| `#161C2B` | `var(--card2)` | carte imbriquée / chip |
| `#EAEEF6` | `var(--text)` | texte principal |
| `#AAB2C4` | `var(--text2)` | texte secondaire |
| `#868EA2` | `var(--text3)` | labels / hints |
| `#6C47FF`/`#8B6FFF`/`#A991FF` | `var(--p)`/`--p2`/`--p3` | primaire (UI, texte violet = `--p2`) |
| `#FFB020` | `var(--acc)` | **montants / argent** (or) |
| `#22C77A`/`#34E19A` | `var(--acc2)`/`--success` | succès, remise, en stock |
| `#4F86F0` | `var(--acc3)` | info / Wave |
| `#FFC53D` | `var(--warn)` | stock bas, écart, hors-ligne |
| `#FF5C72` | `var(--danger)` | erreur, écart critique |
| dégradé CTA | `var(--grad-p)` | boutons primaires |
| bordure fine | `var(--border)` / `--border2` | cartes |
| glow violet | `var(--border3)` | carte mise en avant |

- **Police** Geist (déjà globale). **Contraste WCAG AA** (garder `contrast-aa.test.ts` vert). Doit rester correct en **thème Clair**.
- **Cibles tactiles ≥ 44px** en usage réel (les maquettes montrent 24–30px pour la densité ; à agrandir en tactile).
- **Devise dynamique** : jamais « FCFA » codé en dur. Utiliser `fmt()` (conversion XOF→devise d'affichage). Le symbole suit le tenant (XOF/XAF/EUR…).
- **i18n** : tous les libellés via `t()` (fr/en/es/it), 0 chaîne en dur.
- **a11y** : labels, `:focus-visible`, `useModalFocus` pour les feuilles/modales, `announce()` pour les changements d'état.
- **Ne pas casser** : scan EAN-13, sélection client fidélité (`HABA-CUST:<id>`), file offline idempotente, multi-paiement, session caisse, multi-boutiques. **Aucune logique métier modifiée** (UI seulement).
- **E2E** : conserver les `data-testid` utilisés par les specs ; suite `e2e-tenant` verte.

---

## 1. POS principal (`Point de vente`)

Layout **2 colonnes** : catalogue (gauche, ~1.6fr) + panier (droite, ~1fr, min 270px). < 900px → panier en feuille basse / plein écran.

**Header** : boutique active · pill **statut caisse** (« Caisse ouverte » vert / « fermée » gris) · **barre recherche+scan** proéminente (icône loupe + icône code-barres cliquable) · **indicateur réseau** : en ligne (vert discret) ou **« Hors-ligne · N en file »** (ambre `--warn`) quand la queue offline a des ventes.

**Catalogue** : onglets catégories (pills, actif = `--p`) · grille tuiles `auto-fill minmax(112px,1fr)` — icône, nom, **prix en `--acc`** + suffixe devise discret. Produit **stock bas** = bordure `--warn` + point ambre (n'empêche pas la vente). Tap = ajout au panier.

**Panier** : titre « Panier · N » + « Vider » · **puce client fidélité** (avatar initiales, nom, palier, points ; bordure `--border3`) ou « + Client » si aucun · lignes avec **steppers −/+** et sous-total ligne.

**Récap totaux (ventilation fiscale)** :
```
Sous-total            11 900
Remise fidélité (5%)  − 595      (vert --acc2)
─────────
Total HT               9 580     (--text3, discret)
TVA (18%)              1 725     (--text3, discret ; taux = vat_rate tenant)
Total TTC             11 305     (GROS, --acc)   ← chiffre héros
```
Taux TVA = `vat_rate` du tenant (dynamique). Si prix affichés TTC (défaut boutique) → HT/TVA dérivés ; gérer aussi le mode HT. CTA **« Encaisser »** (`--grad-p`) → ouvre la feuille d'encaissement.

**États** : offline (badge + Mobile Money désactivé, cash-only), stock bas, caisse fermée (catalogue grisé + « Ouvrir la caisse »), panier vide (illustration + hint).

---

## 2. Encaissement (feuille modale)

Ouverte au clic « Encaisser ». `useModalFocus`, fermeture par X / Échap / clic hors zone.

- **Total à payer** (bloc centré, `--acc` gros) + sous-ligne **« dont TVA 1 725 »**.
- **6 tuiles mode** (grille 3×2, cibles larges) : Espèces (`--acc2`), Wave (`--acc3`), Orange (orange), MTN (`--warn`), Carte (`--p`), **Mixte** (tuile pointillée). Couleurs de marque par opérateur.
- **Espèces sélectionné** : champ « Montant reçu » + raccourcis (Exact / arrondis) + **« Rendu monnaie »** en `--acc2`, gros.
- **Mobile Money** (Wave/Orange/MTN) : bascule sur champ **téléphone** + « Initier le paiement » → état **« En attente de confirmation… »** (spinner, webhook) → succès/échec.
- **Mixte** : empiler plusieurs lignes (mode + montant), **« Reste à payer »** décompté jusqu'à 0.
- **Offline** : Mobile Money/Carte désactivés, cash-only.
- CTA **« Valider l'encaissement »** (`--grad-p`) → ticket (impression/WhatsApp/PDF), points crédités serveur.

---

## 3. Clôture de caisse — Ticket Z

Écran/feuille. Réservé MANAGER+.

- **En-tête** : « Clôture de caisse » + badge « Ticket Z · date » · ligne session (caissier · heure d'ouverture · N ventes).
- **Ventes par mode** : liste (pastille couleur + libellé + montant) → **Total ventes** (`--acc`).
- **Caisse espèces** : `Fond de caisse` + `Ventes espèces` = **Espèces attendues** · champ **« Montant compté »** · **Écart** : `= 0` vert « caisse juste » / petit écart `--warn` / important `--danger`.
- Actions : « Annuler » (secondaire) + **« Clôturer & imprimer Z »** (`--grad-p`, icône imprimante).
- Seules les **espèces** se comptent (Mobile Money réconcilié par webhook).
- **Ouverture de caisse** (miroir simplifié) : champ « Fond de caisse » (pré-rempli `posDefaultFund`) + « Ouvrir la caisse ».

---

## 4. Carte de fidélité (vue client)

- **Carte hero** : fond légèrement teinté par palier (Bronze/Silver/Gold), bordure `--border3` · badge palier · nom client · **solde points en `--acc`** · **QR** (blanc, encode `HABA-CUST:<id>` — simple sélecteur, **aucune crypto/HMAC**) · **barre de progression** vers le palier suivant (« 160 pts jusqu'à Gold », 340/500).
- **Palier actuel vs prochain** (2 cartes) : remise en % (configurable par tenant : seuils + remises).
- **Activité récente** : points gagnés (`--acc2`, +N) / dépensés (`--danger`/rose, −N), avec le montant de vente lié.
- Points **calculés serveur** (jamais côté client). Intégration POS : sélection client → remise appliquée visible dans le récap panier.

---

## 5. Onboarding tenant (wizard)

- **En-tête** : logo Sac+H + « Bienvenue sur HabaShop » + « N / 5 ».
- **Fil d'étapes** (5, icônes) : Boutique · Devise & langue · Équipe · Produits · C'est parti. Étape courante = `--p`, faites = check, à venir = `--card2`/`--text3`.
- **Contenu étape 1 (Boutique)** : nom, **type de commerce** (chips : Épicerie/Superette/Demi-gros/Grossiste), ville/pays · hint pédagogique (« apparaîtront sur vos tickets »).
- **Navigation** : **« Passer pour l'instant »** (skip, progressive disclosure — ne jamais bloquer) + « Continuer » (`--grad-p`).
- **Empty states actionnables** sur chaque module tant que non configuré (illustration + CTA). Flag `habashop_onboarded` (localStorage) ; auto-redirect Dashboard pour ADMIN sans produits/ventes (déjà en place — ne pas régresser).

---

## Récap des écrans à implémenter
POS principal · Encaissement (+ variations Mobile Money / Mixte) · Ouverture & Clôture Ticket Z · Carte fidélité · Onboarding wizard. Priorité : **POS d'abord** (usage quotidien).
