<div align="center">

# 🛍️ HabaShop Mobile

**Application mobile de gestion commerciale pour l'Afrique**

[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=flat-square&logo=expo)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Android](https://img.shields.io/badge/Android-✅-3DDC84?style=flat-square&logo=android)](https://play.google.com)
[![iOS](https://img.shields.io/badge/iOS-🔜-000000?style=flat-square&logo=apple)](https://apple.com)

[📱 Télécharger l'APK](#-installation) · [🌐 Version Web](https://habashop.vercel.app) · [📚 Documentation](#-développement)

</div>

---

## 📖 À propos

HabaShop Mobile est l'application Android/iOS de **HabaShop**, le SaaS de gestion commerciale pour les boutiques, superettes et commerces d'Afrique francophone.

L'app permet aux commerçants de gérer leur activité depuis leur téléphone :
- 🛒 Encaisser des ventes en quelques secondes
- 📦 Gérer le stock et recevoir des alertes de rupture
- 👥 Consulter la liste et les fiches clients
- 📊 Suivre les KPIs du jour en temps réel
- 💱 Support multi-devises (XOF, XAF, EUR, USD, GBP, CAD)
- 🌍 Interface en 4 langues (FR, EN, ES, IT)

---

## 📱 Captures d'écran

> _Captures à venir._

| Login | Dashboard | POS |
|-------|-----------|-----|
| 🔐 Connexion sécurisée | 📊 KPIs temps réel | 🛒 Caisse complète |

| Stock | Clients | Réglages |
|-------|---------|----------|
| 📦 Alertes rupture | 👥 Fiche + appel/WhatsApp | ⚙️ Langue + devise |

---

## ✨ Fonctionnalités

### 🛒 Point de Vente (POS)
- Grille produits avec recherche et filtres par catégorie
- Panier avec ajout/suppression/quantités
- 4 modes de paiement : Espèces, Wave, Orange Money, Carte
- Calcul automatique de la monnaie rendue
- Enregistrement de la vente via l'API (`POST /api/sales`)
- Haptic feedback à chaque ajout produit

### 📦 Gestion du Stock
- Liste complète avec statuts colorés (En stock / Stock bas / Rupture)
- Alertes visuelles et chips filtrables
- Édition de quantité directement depuis l'app (`PUT /api/products/:id`)
- Pull-to-refresh

### 📊 Dashboard
- CA du jour et du mois, nb transactions, produits, alertes stock
- Top 5 produits les plus vendus
- Actions rapides vers tous les modules
- Données en temps réel (`GET /api/dashboard/stats`)

### 👥 Clients
- Liste avec avatar coloré par type (Grossiste / Semi-gros / Détail / Fidèle)
- Fiche client : CA total, points fidélité, historique
- Appel direct et WhatsApp en un tap
- Recherche par nom, email, téléphone

### ⚙️ Réglages
- Sélecteur de langue (FR/EN/ES/IT) persisté
- Sélecteur de devise (XOF/XAF/EUR/USD/GBP/CAD)
- Conversion FX réelle via open.er-api.com (cache 6h, fallback fixe)
- Infos boutique (plan, statut, devise) · Déconnexion sécurisée

---

## 🚀 Installation

### Prérequis
- **Android 7.0+ (API 24)** — minimum requis par RN 0.81 / Expo SDK 54
- [Expo Go](https://expo.dev/client) (pour le dev) ou l'APK direct

### Option 1 — Expo Go (développement)
```bash
npx expo start --clear   # puis scanne le QR avec Expo Go (Android, SDK 54)
```

### Option 2 — APK direct (recommandé)
1. Télécharge le dernier APK depuis [EAS Builds](https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile/builds)
2. Transfère sur ton Android (USB ou Google Drive)
3. Autorise les « sources inconnues » si demandé
4. Installe et ouvre HabaShop

---

## 🏗️ Architecture

```
habashop-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout (fonts, QueryClient, restoreSession)
│   ├── index.tsx                 # Route '/' → redirect auth (fix écran noir en build)
│   ├── (auth)/login.tsx          # Écran de connexion
│   └── (app)/
│       ├── pos/index.tsx         # Caisse (modal plein écran)
│       └── (tabs)/               # dashboard · stock · pos-tab · customers · settings
├── src/
│   ├── constants/theme.ts        # Design tokens (couleurs, fonts, espacements)
│   ├── stores/                   # authStore (JWT+SecureStore) · appStore (i18n+devise) · posStore
│   └── services/                 # api.ts (axios) · exchangeRate.ts (FX) · notifications.ts (push)
├── assets/                       # icon · icon-ios (RGB sans alpha) · adaptive-icon · splash-icon · notification-icon
├── app.json                      # Config Expo + EAS
└── eas.json                      # Profils de build EAS (development / preview / production)
```

---

## 🔌 API Backend

L'app consomme l'API HabaShop existante sur Railway. **Aucune modification backend** (hors route push tokens, déjà déployée).

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login` | POST | Connexion |
| `/api/auth/me` | GET | Session courante |
| `/api/products` | GET | Liste produits |
| `/api/products/:id` | **PUT** | Mise à jour (⚠️ PUT, pas PATCH) |
| `/api/sales` | POST | Enregistrer une vente (`items:[{productId, qty, price}]`) |
| `/api/customers` | GET | Liste clients |
| `/api/dashboard/stats` | GET | KPIs dashboard (réponse à plat) |
| `/api/notifications/token` | POST | Enregistrement push (idempotent) |

---

## 🌍 Internationalisation

L'app supporte **4 langues** avec persistence :

| Code | Langue | | Code | Langue |
|------|--------|-|------|--------|
| `fr` | 🇫🇷 Français | | `es` | 🇪🇸 Español |
| `en` | 🇬🇧 English | | `it` | 🇮🇹 Italiano |

### Devises avec conversion FX réelle

| Code | Symbole | Région |
|------|---------|--------|
| XOF | FCFA | Afrique de l'Ouest (UEMOA) |
| XAF | FCFA | Afrique Centrale (CEMAC) |
| EUR | € | Europe |
| USD | $ | États-Unis |
| GBP | £ | Royaume-Uni |
| CAD | CA$ | Canada |

> Taux récupérés en temps réel via [open.er-api.com](https://open.er-api.com), cache 6h, fallback sur taux fixes si l'API est indisponible. Les montants sont stockés en **XOF** ; la conversion est faite **à l'affichage uniquement**.

---

## 🔨 Développement

### Prérequis
- **Node.js 20** (`export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`)
- EAS CLI (`npm install -g eas-cli`) — auth via `eas login` dans ton terminal
- Le CLI Expo est utilisé via `npx expo` (pas d'install globale)

### Installation
```bash
git clone https://github.com/ndjoumessi/habashop-mobile.git
cd habashop-mobile
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm install

cp .env.example .env   # puis renseigne EXPO_PUBLIC_API_URL
```

### Lancer en développement
```bash
npx expo start --clear        # Expo Go (SDK 54)
npx expo start --dev-client   # dev build (notifications push)
```

### Build (EAS)
```bash
eas build --platform android --profile preview      # APK (test direct)
eas build --platform android --profile production    # AAB (Google Play)
eas build --platform ios --profile production        # iOS (compte Apple Developer requis)
```

### Vérifications
```bash
npx tsc --noEmit      # TypeScript : 0 erreur
npx expo-doctor       # objectif 18/18 ✅
```

---

## 🗺️ Roadmap

### ✅ Sprint 1 (MVP)
- [x] Authentification JWT · Dashboard KPIs temps réel
- [x] POS (caisse) complet · Stock + alertes
- [x] Liste et fiches clients · Réglages (langue + devise)
- [x] i18n 4 langues · Conversion FX réelle
- [x] Build APK Android (EAS) · Notifications push (infra)

### 🔜 Sprint 2
- [ ] Scanner code-barres EAN13 (expo-camera)
- [ ] Mode hors-ligne (cache + file d'actions)
- [ ] Ticket WhatsApp après vente
- [ ] Écran Rapports & Analytics
- [ ] Build iOS (App Store)

### 🔜 Sprint 3
- [ ] RH & Planning · Dépenses & Fournisseurs
- [ ] Biométrie (Face ID / Fingerprint)
- [ ] Widgets Android (CA du jour)
- [ ] Publication Google Play Store

---

## 🔗 Liens

| Ressource | URL |
|-----------|-----|
| 🌐 Web App | https://habashop.vercel.app |
| 🔧 Backend API | https://habashop-production.up.railway.app |
| 📦 Repo Web | https://github.com/ndjoumessi/habashop |
| 📱 Repo Mobile | https://github.com/ndjoumessi/habashop-mobile |
| 📊 EAS Builds | https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile |

---

## 👨‍💻 Auteur

**Nelson Djoumessi** — [@ndjoumessi](https://github.com/ndjoumessi) · romel.djoumessi@gmail.com

---

<div align="center">

Fait avec ❤️ pour les commerçants d'Afrique 🌍

🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇬🇳 🇨🇲 🇹🇬 🇧🇯 🇳🇪 🇬🇭

</div>
