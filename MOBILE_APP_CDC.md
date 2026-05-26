# 📱 HabaShop Mobile — Cahier des Charges

**Version :** 1.0
**Date :** 2026-05-26
**Stack :** React Native + Expo

---

## 1. Contexte & Objectifs

### 1.1 Pourquoi une app mobile ?
- Les commerçants africains utilisent principalement leur smartphone
- Caisse POS mobile = ventes sans ordinateur
- Notifications push pour les alertes stock
- Mode offline natif (PWA limitée sur Android)
- Scan code-barres avec caméra native

### 1.2 Objectifs
- Caisse POS complète sur mobile
- Gestion stock en temps réel
- Alertes rupture de stock (push)
- Rapports quotidiens
- Compatible iOS + Android
- **Partage de l'API backend HabaShop existante** (Fastify 5 / Railway, aucune réécriture serveur)

---

## 2. Stack technique

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Framework | React Native 0.74 + Expo SDK 51 | Développement rapide, partage de code avec le web |
| Navigation | Expo Router v3 (file-based) | Similaire à React Router, deep linking |
| State | Zustand (même logique que le web) | Réutilise le store `appStore` HabaShop |
| UI | NativeWind (Tailwind pour RN) | Cohérence avec le design web |
| Auth | JWT (même API HabaShop) | Aucun backend supplémentaire |
| Offline | MMKV + React Query | Cache local ultra-rapide |
| Barcode | expo-camera (barcode scanning) | Accès caméra natif (remplace `expo-barcode-scanner` déprécié) |
| Push | Expo Notifications | iOS + Android unifié |
| Paiement | WebView Wave / Orange Money | Réutilise l'intégration `/api/payments/*` existante |
| Charts | Victory Native | Charts optimisés React Native |

> **Note** : le web utilise `@zxing` (web) pour le scan ; sur mobile on passe à la caméra native (`expo-camera`), plus performante et sans le poids de 112 kB gz côté bundle.

---

## 3. Modules — Phase 1 (MVP)

### 3.1 Authentification
- Login email/password (`POST /api/auth/login`)
- Remember me (MMKV)
- Biométrie optionnelle (Face ID / Fingerprint via `expo-local-authentication`)
- Multi-tenant (même compte que le web, JWT scopé `tenantId`)

### 3.2 POS Mobile (priorité #1)
- Catalogue produits avec photos (`GET /api/products`)
- Recherche + filtre catégories
- Scan code-barres (caméra → recherche par EAN13)
- Panier avec quantités
- Modes de paiement : espèces, Wave, Orange Money
- Calcul de la monnaie automatique
- Ticket de caisse → partage WhatsApp (`/api/whatsapp/send-ticket`)
- Mode offline (ventes stockées localement)
- Sync automatique au retour en ligne (`POST /api/sales`)

### 3.3 Stock (priorité #2)
- Liste produits avec stock temps réel
- Alertes stock bas (badge + push) — seuil `stockMin`
- Modifier la quantité en stock (`PUT /api/products/:id`)
- Scan EAN13 pour retrouver un produit
- Historique des mouvements

### 3.4 Dashboard (priorité #3)
- CA du jour / semaine / mois (`GET /api/dashboard/stats`, cache Redis 5 min)
- Nb de transactions
- Top produits
- Graphique des ventes 7 jours
- Dernières ventes

### 3.5 Clients (priorité #4)
- Liste clients + recherche (`GET /api/customers`)
- Fiche client (CA, fidélité, historique)
- Appel direct depuis la fiche
- WhatsApp depuis la fiche

---

## 4. Modules — Phase 2

- RH (planning, présences)
- Fournisseurs (commandes)
- Dépenses
- Rapports avancés
- Notifications push personnalisées

---

## 5. Architecture

```
habashop-mobile/
├── app/                    # Expo Router (screens)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (app)/
│   │   ├── _layout.tsx     # Tab navigation
│   │   ├── pos/
│   │   │   ├── index.tsx   # Catalogue
│   │   │   ├── cart.tsx    # Panier
│   │   │   └── payment.tsx # Encaissement
│   │   ├── stock/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── dashboard.tsx
│   │   └── clients/
│   └── _layout.tsx         # Root layout
├── components/
│   ├── ui/                 # Boutons, inputs, cards
│   ├── pos/                # Composants POS
│   └── stock/              # Composants stock
├── hooks/
│   ├── useApi.ts           # Même API HabaShop
│   ├── useOffline.ts
│   └── useBarcode.ts
├── stores/
│   └── appStore.ts         # Zustand (logique partagée avec le web)
├── services/
│   ├── api.ts              # Réutilise l'API HabaShop (Railway)
│   ├── offline.ts          # File MMKV
│   └── notifications.ts
└── constants/
    ├── theme.ts            # Tokens couleurs HabaShop
    └── config.ts
```

---

## 6. Design System Mobile

### 6.1 Couleurs (identiques au web — `apps/frontend/src/index.css`)
```typescript
export const colors = {
  primary:    '#6C47FF',
  primary2:   '#8B6FFF',
  accent:     '#FF9500',
  accent2:    '#00D084',
  accent3:    '#00B8FF',
  danger:     '#FF3B5C',
  warn:       '#FFB800',
  bg:         '#07070F',
  card:       '#0D0D1C',
  border:     'rgba(255,255,255,.07)',
  text:       '#F0F0FF',
  text2:      '#C4C4D4',
  text3:      '#8888A8',
}
```

### 6.2 Typographie
- Titres : Outfit / Plus Jakarta Sans 700–900 (`expo-font`)
- Corps : 400–600
- Chiffres : JetBrains Mono

### 6.3 Composants clés
- `ProductCard` : photo + nom + prix + stock
- `CartItem` : nom + quantité + prix
- `StatCard` : KPI avec icône
- `SaleRow` : transaction récente

---

## 7. Offline First

### 7.1 Stratégie
```
Online  : API HabaShop → affichage temps réel
Offline : MMKV cache → affichage des données cachées
          + file d'attente des actions (ventes, mouvements)
Retour  : Sync automatique de la file
```

### 7.2 Données cachées
- Catalogue produits (TTL 24 h)
- Clients (TTL 1 h)
- Stock actuel (TTL 5 min en ligne)

### 7.3 File offline
```typescript
interface OfflineAction {
  id:        string
  type:      'SALE' | 'STOCK_MOVE'
  payload:   any
  createdAt: string
  synced:    boolean
}
```

---

## 8. Notifications Push

### 8.1 Types
| Type | Déclencheur | Priorité |
|------|-------------|----------|
| Rupture stock | `stockQty < stockMin` | 🔴 Haute |
| Vente enregistrée | Après POS | 🟡 Normale |
| Rapport quotidien | 20h chaque jour | 🟢 Basse |
| Essai expire J-3 | Cron backend (existe déjà) | 🔴 Haute |

### 8.2 Backend
- Expo Push API depuis le backend Railway
- Ajout d'une table `PushToken` (Prisma) — `tenantId`, `userId`, `token`, `platform`
- Nouvelle route `POST /api/notifications/token`
- Réutilise le cron d'essai existant (`server.ts` → `runTrialReminders`) pour pousser les rappels J-3

---

## 9. Plan de développement

### Phase 1 — MVP (6 semaines)
| Semaine | Tâches |
|---------|--------|
| 1 | Setup Expo + Auth + navigation |
| 2 | POS catalogue + panier |
| 3 | POS encaissement + offline |
| 4 | Stock + alertes push |
| 5 | Dashboard + rapports |
| 6 | Tests + polish + déploiement stores |

### Phase 2 — Complet (4 semaines)
| Semaine | Tâches |
|---------|--------|
| 7 | RH + planning |
| 8 | Fournisseurs + dépenses |
| 9 | Clients enrichi + WhatsApp |
| 10 | Optimisations + A/B test |

---

## 10. Déploiement

### iOS App Store
- Compte Apple Developer : 99 $/an
- Délai de review : 1–7 jours
- TestFlight pour la bêta

### Google Play Store
- Compte Google Play : 25 $ (une fois)
- Délai de review : 1–3 jours
- Internal testing pour la bêta

### OTA Updates (Expo EAS Update)
- Corrections de bugs sans re-soumission

---

## 11. Estimation des coûts

| Poste | Coût | Fréquence |
|-------|------|-----------|
| Apple Developer | $99 | /an |
| Google Play | $25 | une fois |
| Expo EAS | $0–29 | /mois |
| **Total an 1** | **~$220** | |

---

## 12. Commande de démarrage

```bash
# Créer le projet
npx create-expo-app habashop-mobile \
  --template expo-template-blank-typescript

cd habashop-mobile

# Dépendances principales
npx expo install \
  expo-router \
  expo-camera \
  expo-notifications \
  expo-local-authentication \
  expo-font \
  react-native-mmkv \
  zustand \
  @tanstack/react-query \
  nativewind \
  victory-native

# Backend URL (même Railway que le web)
echo "EXPO_PUBLIC_API_URL=https://habashop-production.up.railway.app" > .env

# Démarrer
npx expo start
```

---

## 13. Réutilisation de l'existant HabaShop

| Côté web (existant) | Réutilisable mobile ? |
|---------------------|------------------------|
| API Fastify 5 / Railway | ✅ Telle quelle (JWT, multi-tenant) |
| Endpoints `/api/payments/wave\|orange` | ✅ Via WebView |
| Store Zustand `appStore` (devises, i18n) | ✅ Logique portable |
| `useI18n` (fr/en/es/it) | ✅ Adapter au runtime RN |
| Tokens couleurs (`index.css`) | ✅ Copiés dans `constants/theme.ts` |
| Emails transactionnels (Resend) | ✅ Inchangés (backend) |
| `@zxing` (scan web) | ❌ Remplacé par `expo-camera` |
| Styles inline / CSS web | ❌ Réécrits en NativeWind |

> Le backend ne nécessite que **2 ajouts** pour le mobile : la table `PushToken` + la route d'enregistrement de token. Tout le reste de l'API est déjà consommable tel quel.
