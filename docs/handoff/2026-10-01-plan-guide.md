# Manuel d'utilisation public `/guide` — plan d'implémentation

> **Pour un agent exécutant :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans`, tâche par tâche.

**But** : une page publique `/guide` qui explique à un commerçant comment se servir des huit
modules qu'il ouvre chaque jour, en quatre langues.

**Architecture** : une route publique paresseuse sur le modèle de `/privacy`, un sommaire ancré
et une section par module. Le contenu vit dans `src/content/guide/` (un module par fichier,
quatre langues côte à côte) pour qu'aucun fichier ne dépasse le plafond de lisibilité du dépôt.

**Pile** : React 18 · React Router 7 · `useI18n()` · vitest.

**Spec** : [`docs/handoff/2026-10-01-demo-jetable-et-guide-design.md`](2026-10-01-demo-jetable-et-guide-design.md) § 2.

**Indépendant du plan « démo jetable »** — les deux se livrent séparément, dans n'importe quel ordre.

## Contraintes globales

- `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` avant toute commande ;
  `set -euo pipefail` sur toute commande composée.
- `npx tsc --noEmit` jamais pipé, jamais depuis la racine.
- **Les QUATRE langues, toujours** (`i(fr, en, es, it)`) — jamais un binaire FR/EN.
- **Icônes Lucide uniquement**, pas d'emoji d'interface. Couleurs par `var(--…)`.
- ⚠️ **Le manuel ne documente QUE les capacités ✅ du CDC v4.** Décrire une capacité ⚠️ inerte,
  🧪 en bac à sable ou ⬜ absente est exactement ce que la vitrine a déjà payé — « Déployé dans
  150+ pays » et les badges SSL/TLS ont été retirés parce qu'ils étaient faux, et
  `login.anchor.test.tsx` fige aujourd'hui leur absence. Un manuel est plus crédible qu'une
  vitrine : une fausseté y coûte plus cher.
- Le lint front est un cliquet : zéro nouvel avertissement.

## ⚠️ Correction de périmètre par rapport à la décision initiale

Le périmètre choisi était : Caisse · Stock & produits · Codes-barres & étiquettes · Clients &
fidélité · Dépenses · Rapports · Réglages · **Mobile & hors-ligne**.

**Le huitième n'est pas documentable** : `docs/HabaShop_CDC_v4.md:251` porte
« Vente hors-ligne | ⚠️ | **Mobile uniquement, et l'application n'est publiée nulle part** ».
Le décrire serait documenter une capacité que personne ne peut utiliser.

**Remplacement proposé : « Utilisateurs & rôles »** (`CDC:291`, ✅ — 6 rôles et matrice de
permissions). C'est ce qu'un commerçant règle dès qu'il a un employé : qui encaisse, qui
rembourse, qui voit les marges. ⚠️ **À arbitrer à la revue du plan** — l'autre candidat ✅ est
« Fournisseurs & commandes » (`CDC:270-272`).

## Points de vigilance de revue

1. **Un visiteur arrive sur `/guide#caisse` directement** (lien partagé). Attendu : la section
   est visible et le sommaire reflète la position ; pas de saut avorté parce que la page est
   encore en chargement paresseux. → **T1, étape 1**
2. **La langue change pendant la lecture.** Attendu : le contenu suit, et l'ancre courante reste
   valide — les identifiants d'ancre sont **stables et non traduits**. → **T1, étape 1**
3. **Le visiteur est sur un téléphone de 360 px.** Attendu : aucun débordement horizontal, le
   sommaire ne mange pas l'écran. ⚠️ L'espagnol et l'italien rallongent. → **T4, étape 3**
4. **Un lecteur d'écran parcourt la page.** Attendu : un seul `h1`, une hiérarchie `h2`/`h3`
   sans saut de niveau, le sommaire est une vraie liste de liens. → **T1, étape 1**
5. **Une capacité passe de ✅ à ⚠️ dans le CDC** (une clé expire, un prestataire tombe).
   Attendu : le verrou du manuel rougit, parce qu'il **dérive** du CDC au lieu de recopier une
   liste. → **T4, étape 1**

---

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `apps/frontend/src/pages/Guide.tsx` *(créé)* | coquille : `h1`, sommaire, rendu des sections |
| `apps/frontend/src/content/guide/types.ts` *(créé)* | le type d'une section, les 4 langues |
| `apps/frontend/src/content/guide/index.ts` *(créé)* | l'ordre des sections — **source unique** |
| `apps/frontend/src/content/guide/caisse.ts` … *(créés, 8)* | un module par fichier |
| `apps/frontend/src/App.tsx` *(modifié)* | route publique `/guide` |
| `apps/frontend/src/components/landing/LandingFooter.tsx` *(modifié)* | lien vers le guide |
| `apps/frontend/src/components/landing/landingShared.ts` *(modifié)* | libellé `footer_links.guide` ×4 |
| `apps/frontend/scripts/seo/sitemap.xml.tmpl` *(modifié)* | entrée `/guide` |

---

### Tâche 1 : la coquille `/guide` + une section pilote

**Fichiers**
- Créer : `src/content/guide/types.ts`, `src/content/guide/index.ts`, `src/content/guide/caisse.ts`
- Créer : `src/pages/Guide.tsx`
- Modifier : `src/App.tsx`
- Test : `src/tests/guidePage.test.tsx`

**Interfaces**
- Produit : `type GuideLang = 'fr' | 'en' | 'es' | 'it'` ·
  `type Traduit = Record<GuideLang, string>` ·
  `interface GuideSection { id: string; titre: Traduit; intro: Traduit; etapes: { titre: Traduit; corps: Traduit }[] }` ·
  `GUIDE_SECTIONS: readonly GuideSection[]`
- ⚠️ **`id` n'est JAMAIS traduit** : c'est l'ancre, elle doit survivre à un changement de langue
  et rester valide dans un lien partagé.

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/frontend/src/tests/guidePage.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Guide from '@/pages/Guide'
import { GUIDE_SECTIONS } from '@/content/guide'
import { useAppStore } from '@/stores/appStore'

const LANGUES = ['fr', 'en', 'es', 'it'] as const

function monter() {
  return render(<MemoryRouter><Guide /></MemoryRouter>)
}

beforeEach(() => { useAppStore.setState({ lang: 'fr' } as never) })

describe('page /guide', () => {
  it('un SEUL h1 — hiérarchie correcte pour un lecteur d’écran', () => {
    monter()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('chaque section est un h2 portant son ancre STABLE', () => {
    monter()
    for (const s of GUIDE_SECTIONS) {
      const el = document.getElementById(s.id)
      expect(el, `ancre #${s.id} absente du DOM`).toBeTruthy()
      expect(el?.tagName.toLowerCase()).toBe('h2')
    }
  })

  it('le sommaire est une vraie liste de liens, un par section', () => {
    monter()
    const liens = screen.getByRole('navigation', { name: /sommaire|contents/i }).querySelectorAll('a')
    expect(liens).toHaveLength(GUIDE_SECTIONS.length)
    expect([...liens].map(a => a.getAttribute('href'))).toEqual(GUIDE_SECTIONS.map(s => `#${s.id}`))
  })

  it('⚠️ les ancres ne changent PAS avec la langue — un lien partagé reste valide', () => {
    const avant = GUIDE_SECTIONS.map(s => s.id)
    for (const l of LANGUES) {
      useAppStore.setState({ lang: l } as never)
      const { unmount } = monter()
      expect(GUIDE_SECTIONS.map(s => s.id)).toEqual(avant)
      for (const id of avant) expect(document.getElementById(id)).toBeTruthy()
      unmount()
    }
  })

  it('⚠️ le contenu suit la langue — le titre de section change', () => {
    useAppStore.setState({ lang: 'fr' } as never)
    const fr = monter()
    const titreFr = document.getElementById(GUIDE_SECTIONS[0].id)?.textContent
    fr.unmount()
    useAppStore.setState({ lang: 'en' } as never)
    monter()
    expect(document.getElementById(GUIDE_SECTIONS[0].id)?.textContent).not.toBe(titreFr)
  })

  it('⚠️ COMPLÉTUDE : chaque chaîne porte ses QUATRE langues, aucune vide', () => {
    expect(GUIDE_SECTIONS.length).toBeGreaterThan(0) // un index vide ne garderait rien
    for (const s of GUIDE_SECTIONS) {
      for (const l of LANGUES) {
        expect(String(s.titre[l] ?? '').trim(), `titre ${s.id}/${l}`).not.toBe('')
        expect(String(s.intro[l] ?? '').trim(), `intro ${s.id}/${l}`).not.toBe('')
      }
      expect(s.etapes.length, `section ${s.id} sans étape`).toBeGreaterThan(0)
      for (const [k, e] of s.etapes.entries()) for (const l of LANGUES) {
        expect(String(e.titre[l] ?? '').trim(), `étape ${s.id}#${k} titre ${l}`).not.toBe('')
        expect(String(e.corps[l] ?? '').trim(), `étape ${s.id}#${k} corps ${l}`).not.toBe('')
      }
    }
  })

  it('⚠️ aucune traduction n’est un copier-coller du français sur TOUTE une section', () => {
    for (const s of GUIDE_SECTIONS) {
      for (const l of ['en', 'es', 'it'] as const) {
        expect(s.titre[l], `titre ${s.id} non traduit en ${l}`).not.toBe(s.titre.fr)
      }
    }
  })

  it('les identifiants de section sont uniques', () => {
    const ids = GUIDE_SECTIONS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('les ancres sont des slugs sûrs pour une URL', () => {
    for (const s of GUIDE_SECTIONS) expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/guidePage.test.tsx
```

- [ ] **Étape 3 : écrire `content/guide/types.ts`**

```ts
// apps/frontend/src/content/guide/types.ts
/**
 * MANUEL D'UTILISATION — types du contenu.
 *
 * ⚠️ `id` n'est JAMAIS traduit : c'est l'ancre de l'URL. Un identifiant traduit casserait
 * tout lien partagé au premier changement de langue du lecteur.
 *
 * ⚠️ Les QUATRE langues sont exigées par le TYPE, pas par une convention : `Record<GuideLang,
 * string>` fait rougir `tsc` s'il en manque une. C'est le compilateur qui garde la règle, pas
 * la vigilance du rédacteur.
 */
export type GuideLang = 'fr' | 'en' | 'es' | 'it'

/** Une chaîne dans les quatre langues. Aucune n'est optionnelle. */
export type Traduit = Record<GuideLang, string>

export interface GuideEtape {
  titre: Traduit
  corps: Traduit
}

export interface GuideSection {
  /** Ancre d'URL — slug stable, non traduit, unique. */
  id: string
  titre: Traduit
  intro: Traduit
  etapes: GuideEtape[]
}
```

- [ ] **Étape 4 : écrire la section pilote `content/guide/caisse.ts`**

C'est le **modèle de rédaction** des sept autres : une intro qui dit à quoi sert l'écran, puis
des étapes courtes qui nomment les gestes réels de l'interface.

```ts
// apps/frontend/src/content/guide/caisse.ts
import type { GuideSection } from './types'

/**
 * CAISSE — `CDC:248-250` : point de vente ✅, ticket 80 mm ✅, ticket WhatsApp ✅ (Twilio).
 *
 * ⚠️ NE PAS mentionner la vente hors-ligne : `CDC:251` la donne ⚠️ « mobile uniquement, et
 * l'application n'est publiée nulle part ». Ni les paiements mobiles comme moyens
 * d'encaissement réels : MTN, Campay et PayDunya sont 🧪 en bac à sable, Wave et Orange
 * Money ⚠️ sans clés.
 */
export const caisse: GuideSection = {
  id: 'caisse',
  titre: {
    fr: 'Encaisser une vente',
    en: 'Taking a sale',
    es: 'Cobrar una venta',
    it: 'Incassare una vendita',
  },
  intro: {
    fr: 'L’écran Caisse sert à encaisser. Vous ajoutez des articles, vous choisissez le mode de paiement, vous imprimez ou envoyez le ticket. Le prix facturé est toujours celui du catalogue : le serveur recalcule le total, même si la caisse a travaillé un moment sans réseau.',
    en: 'The POS screen is where you take payment. You add items, pick a payment method, then print or send the receipt. The price charged is always the catalogue price: the server recalculates the total, even if the till spent a while without a connection.',
    es: 'La pantalla TPV sirve para cobrar. Añade artículos, elige el método de pago e imprime o envía el recibo. El precio cobrado es siempre el del catálogo: el servidor recalcula el total, incluso si la caja estuvo un rato sin conexión.',
    it: 'La schermata Cassa serve a incassare. Aggiungi gli articoli, scegli il metodo di pagamento, poi stampi o invii la ricevuta. Il prezzo applicato è sempre quello del catalogo: il server ricalcola il totale, anche se la cassa è rimasta un po’ senza rete.',
  },
  etapes: [
    {
      titre: { fr: 'Ouvrir la caisse', en: 'Open the till', es: 'Abrir la caja', it: 'Aprire la cassa' },
      corps: {
        fr: 'Avant la première vente de la journée, ouvrez la caisse en saisissant le fond de caisse — l’argent présent dans le tiroir. C’est ce montant qui servira au calcul de l’écart à la clôture.',
        en: 'Before the day’s first sale, open the till by entering the opening float — the cash already in the drawer. That amount is what the closing variance is measured against.',
        es: 'Antes de la primera venta del día, abra la caja indicando el fondo inicial: el dinero que ya está en el cajón. Ese importe es la base del cálculo de la diferencia al cierre.',
        it: 'Prima della prima vendita del giorno, apri la cassa inserendo il fondo cassa — il denaro già presente nel cassetto. È su quell’importo che si calcola lo scostamento alla chiusura.',
      },
    },
    {
      titre: { fr: 'Ajouter les articles', en: 'Add the items', es: 'Añadir los artículos', it: 'Aggiungere gli articoli' },
      corps: {
        fr: 'Trois manières, au choix : scanner le code-barres avec la douchette — c’est la plus rapide en boutique —, le scanner avec la caméra, ou toucher l’article dans la grille. Le tarif détail, demi-gros ou gros s’applique par ligne selon le type de client.',
        en: 'Three ways: scan the barcode with a handheld scanner — the fastest in-store —, scan it with the camera, or tap the item in the grid. Retail, semi-wholesale or wholesale pricing applies per line according to the customer type.',
        es: 'Tres formas: escanear el código de barras con el lector de mano —lo más rápido en tienda—, escanearlo con la cámara, o tocar el artículo en la cuadrícula. El precio minorista, semimayorista o mayorista se aplica por línea según el tipo de cliente.',
        it: 'Tre modi: scansionare il codice a barre con il lettore — il più rapido in negozio —, scansionarlo con la fotocamera, oppure toccare l’articolo nella griglia. Il prezzo al dettaglio, semi-ingrosso o ingrosso si applica per riga secondo il tipo di cliente.',
      },
    },
    {
      titre: { fr: 'Encaisser', en: 'Take payment', es: 'Cobrar', it: 'Incassare' },
      corps: {
        fr: 'Choisissez le mode de paiement. Un paiement mixte est possible : répartissez le total entre espèces, mobile et carte, la somme doit correspondre au total. Toute remise manuelle est enregistrée avec son motif.',
        en: 'Pick the payment method. Split payments are supported: spread the total across cash, mobile and card — the parts must add up to the total. Any manual discount is recorded along with its reason.',
        es: 'Elija el método de pago. Se admite el pago mixto: reparta el total entre efectivo, móvil y tarjeta; las partes deben sumar el total. Todo descuento manual se registra con su motivo.',
        it: 'Scegli il metodo di pagamento. È possibile il pagamento misto: ripartisci il totale tra contanti, mobile e carta — le parti devono sommare al totale. Ogni sconto manuale viene registrato con la sua motivazione.',
      },
    },
    {
      titre: { fr: 'Remettre le ticket', en: 'Hand over the receipt', es: 'Entregar el recibo', it: 'Consegnare la ricevuta' },
      corps: {
        fr: 'Imprimez le ticket 80 mm, ou envoyez-le au client par WhatsApp si vous avez son numéro. Sur téléphone, l’impression passe par le service d’impression du système.',
        en: 'Print the 80 mm receipt, or send it to the customer over WhatsApp if you have their number. On a phone, printing goes through the system print service.',
        es: 'Imprima el recibo de 80 mm, o envíelo al cliente por WhatsApp si tiene su número. En el teléfono, la impresión pasa por el servicio de impresión del sistema.',
        it: 'Stampa la ricevuta da 80 mm, o inviala al cliente via WhatsApp se hai il suo numero. Su telefono, la stampa passa dal servizio di stampa del sistema.',
      },
    },
    {
      titre: { fr: 'Clôturer la caisse', en: 'Close the till', es: 'Cerrar la caja', it: 'Chiudere la cassa' },
      corps: {
        fr: 'En fin de journée, comptez le tiroir et saisissez le montant. L’écart se calcule sur les espèces attendues — le fond de caisse plus les ventes encaissées en espèces, pas le chiffre d’affaires tous modes confondus. Un surplus est signalé comme un manque : les deux méritent un regard.',
        en: 'At the end of the day, count the drawer and enter the amount. The variance is measured against expected cash — the opening float plus cash sales, not total revenue across all methods. A surplus is flagged just like a shortfall: both deserve a look.',
        es: 'Al final del día, cuente el cajón e introduzca el importe. La diferencia se calcula sobre el efectivo esperado: el fondo inicial más las ventas en efectivo, no la facturación de todos los métodos. Un excedente se señala igual que un faltante: ambos merecen atención.',
        it: 'A fine giornata, conta il cassetto e inserisci l’importo. Lo scostamento si calcola sul contante atteso — il fondo cassa più le vendite in contanti, non il fatturato di tutti i metodi. Un’eccedenza viene segnalata come una mancanza: entrambe meritano uno sguardo.',
      },
    },
  ],
}
```

- [ ] **Étape 5 : écrire `content/guide/index.ts` — la source unique de l'ordre**

```ts
// apps/frontend/src/content/guide/index.ts
import type { GuideSection } from './types'
import { caisse } from './caisse'

/**
 * ORDRE DU MANUEL — source unique. Le sommaire et les sections en dérivent tous les deux :
 * deux listes divergeraient, et c'est le sommaire qui mentirait.
 */
export const GUIDE_SECTIONS: readonly GuideSection[] = [caisse]

export type { GuideSection } from './types'
```

- [ ] **Étape 6 : écrire `pages/Guide.tsx`**

```tsx
// apps/frontend/src/pages/Guide.tsx
import { useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { GUIDE_SECTIONS } from '@/content/guide'
import type { GuideLang } from '@/content/guide/types'

/**
 * MANUEL D'UTILISATION — page publique.
 *
 * ⚠️ Les ancres (`section.id`) ne sont pas traduites : un lien partagé doit rester valide
 * quelle que soit la langue du lecteur.
 *
 * ⚠️ Sommaire ET sections dérivent de `GUIDE_SECTIONS` — deux listes divergeraient, et c'est
 * le sommaire qui mentirait.
 */
export default function Guide() {
  const { lang } = useI18n()
  const l = lang as GuideLang

  const titrePage = { fr: 'Manuel d’utilisation', en: 'User guide', es: 'Manual de uso', it: 'Manuale d’uso' }[l]
  const sommaire  = { fr: 'Sommaire', en: 'Contents', es: 'Índice', it: 'Indice' }[l]
  const retour    = { fr: '← Retour à HabaShop', en: '← Back to HabaShop', es: '← Volver a HabaShop', it: '← Torna a HabaShop' }[l]

  useEffect(() => { document.title = `${titrePage} — HabaShop` }, [titrePage])

  return (
    <div className="legal-doc" style={{ maxWidth: 820, margin: '0 auto', padding: '40px 16px', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ textDecoration: 'none', fontSize: 'var(--fs-body)' }}>{retour}</a>
      </div>

      <h1 style={{ marginBottom: 24 }}>{titrePage}</h1>

      <nav aria-label={sommaire} style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 'var(--fs-body)', marginBottom: 10 }}>{sommaire}</h2>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {GUIDE_SECTIONS.map(s => (
            <li key={s.id} style={{ marginBottom: 4 }}>
              <a href={`#${s.id}`}>{s.titre[l]}</a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map(s => (
        <section key={s.id} style={{ marginBottom: 44 }}>
          {/* ⚠️ L'id porté par le h2 : l'ancre atterrit sur le titre, pas au-dessus. */}
          <h2 id={s.id} style={{ scrollMarginTop: 24 }}>{s.titre[l]}</h2>
          <p>{s.intro[l]}</p>
          {s.etapes.map((e, k) => (
            <div key={k} style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 'var(--fs-body)', marginBottom: 4 }}>{e.titre[l]}</h3>
              <p style={{ margin: 0 }}>{e.corps[l]}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Étape 7 : ajouter la route publique dans `App.tsx`**

```tsx
const Guide = lazy(() => import('@/pages/Guide'))
```
et, à côté de `/privacy` :
```tsx
      <Route path="/guide" element={<Guide />} />
```
⚠️ **Hors de `ProtectedRoute`** — c'est une page publique, destinée à être partagée et indexée.

- [ ] **Étape 8 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/guidePage.test.tsx
```
Attendu : 9 tests PASS.

- [ ] **Étape 9 : sabotage — traduire l'ancre**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/frontend/src/pages/Guide.tsx
```
Remplacer `id={s.id}` par `id={s.titre[l]}`. Attendu : ÉCHEC sur « ancre STABLE » et sur
« slugs sûrs ». Restaurer.

- [ ] **Étape 10 : sabotage — vider une traduction**

Mettre `it: ''` dans le titre de `caisse`. Attendu : ÉCHEC sur « COMPLÉTUDE ». ⚠️ Vérifier que
`tsc` rougit AUSSI si on **supprime** la clé `it` — c'est le type qui doit garder la règle, le
test ne couvrant que la chaîne vide. Restaurer.

- [ ] **Étape 11 : typecheck + suite complète + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx tsc --noEmit && npx vitest run
git add apps/frontend/src/content/guide apps/frontend/src/pages/Guide.tsx apps/frontend/src/App.tsx apps/frontend/src/tests/guidePage.test.tsx
git commit -m "feat(guide): coquille du manuel public /guide + section Caisse

Les ancres ne sont pas traduites : un lien partagé doit rester valide quelle
que soit la langue du lecteur. Sabotage vérifié.

Les quatre langues sont exigées par le TYPE (Record<GuideLang, string>), donc
gardées par tsc et non par la vigilance du rédacteur ; le test ne couvre que
la chaîne vide, que le type laisse passer.

Sommaire et sections dérivent de la même liste — deux listes divergeraient, et
c'est le sommaire qui mentirait.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 2 : trois sections — Stock & produits, Codes-barres & étiquettes, Clients & fidélité

**Fichiers**
- Créer : `src/content/guide/stock.ts`, `codesBarres.ts`, `clients.ts`
- Modifier : `src/content/guide/index.ts` (ajout à `GUIDE_SECTIONS`)

Chaque fichier suit **exactement** la forme de `caisse.ts` : un `GuideSection` exporté, un
en-tête de commentaire citant les lignes du CDC qui justifient le contenu, et la liste des
capacités à **ne pas** mentionner. Les tests de la tâche 1 couvrent déjà ces sections dès
qu'elles entrent dans `GUIDE_SECTIONS` (complétude ×4, ancres, unicité) — c'est pourquoi il
n'y a pas de nouveau test à écrire ici.

- [ ] **Étape 1 : `stock.ts`** — `id: 'stock'`. Appuis CDC : `253` (Stock & produits ✅).
  Étapes : créer une fiche produit (nom, catégorie, prix d'achat et de vente) · régler le seuil
  d'alerte · faire une entrée de stock · comprendre l'alerte de stock bas · les tarifs par
  palier (détail / demi-gros / gros).
  ⚠️ **Ne pas mentionner** l'import de produits par fichier — `CDC:254` le donne ⬜ et précise
  qu'il avait été *« annoncé par erreur sur la vitrine jusqu'au 6 août, retiré »*. Le
  réintroduire dans un manuel serait remettre exactement l'affirmation qui a été retirée.
  ⚠️ `StockForm.image` est l'**émoji**, `Product.image` est la **photo** — deux champs
  homonymes de sens opposés ; ne pas écrire de phrase qui les confonde.

- [ ] **Étape 2 : `codesBarres.ts`** — `id: 'codes-barres'`. Appuis CDC : `253`.
  Étapes : à quoi sert un code-barres en caisse · scanner avec une douchette (le chemin
  primaire en boutique) ou avec la caméra · imprimer des étiquettes Avery A4 · imprimer des
  étiquettes thermiques 40×30.
  ⚠️ **EAN-13 / EAN-8 uniquement** sur une étiquette. Ne pas suggérer d'imprimer un code à
  partir d'un SKU : un code non standard est un piège en caisse.
  ⚠️ Ne pas promettre de photo produit sur l'étiquette : aucun document (facture, devis,
  étiquette) n'en porte, c'est une décision assumée.

- [ ] **Étape 3 : `clients.ts`** — `id: 'clients'`. Appuis CDC : `260-263` (clients, segments,
  carte de fidélité avec QR ✅ · historique d'achats ✅ · carte géographique ✅ · abonnements ✅).
  Étapes : créer un client · les segments · la carte de fidélité et son QR · la carte
  géographique · les abonnements.
  ⚠️ **Le « Scanner » du panier est le scanner de CARTE FIDÉLITÉ**, fonction distincte du scan
  produit — le manuel doit le dire, c'est précisément la confusion qu'il faut prévenir.
  ⚠️ Les abonnements : **aucun total n'est stocké** (le montant suit le tarif du jour) et la
  **fréquence est hebdomadaire** (le modèle ne porte qu'un jour de semaine). Ne pas promettre
  une fréquence mensuelle ni un montant figé.
  ⚠️ Carte : mentionner que l'adresse est cherchée en ligne et que « Adresse introuvable » peut
  aussi signifier que le service est momentanément indisponible — c'est ce que l'écran dit
  désormais, et le manuel ne doit pas le contredire.

- [ ] **Étape 4 : brancher les trois dans `index.ts`**

```ts
import { caisse } from './caisse'
import { stock } from './stock'
import { codesBarres } from './codesBarres'
import { clients } from './clients'

export const GUIDE_SECTIONS: readonly GuideSection[] = [caisse, stock, codesBarres, clients]
```

- [ ] **Étape 5 : la suite doit rester verte — les tests de T1 couvrent les nouvelles sections**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx tsc --noEmit && npx vitest run src/tests/guidePage.test.tsx
```
Attendu : 9 tests PASS, désormais sur 4 sections. ⚠️ Si « COMPLÉTUDE » rougit, une traduction
manque — la compléter, ne pas relâcher l'assertion.

- [ ] **Étape 6 : commit**

```bash
set -euo pipefail
git add apps/frontend/src/content/guide
git commit -m "feat(guide): sections Stock, Codes-barres, Clients & fidélité

Chaque section cite en en-tête les lignes du CDC qui la justifient ET les
capacités à ne pas mentionner. Trois pièges évités explicitement : l'import de
produits par fichier (retiré de la vitrine parce que faux), le code-barres sur
SKU (non standard, piège en caisse), et la confusion entre le scanner de carte
de fidélité du panier et le scan produit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 3 : trois sections — Dépenses, Rapports, Utilisateurs & rôles

**Fichiers**
- Créer : `src/content/guide/depenses.ts`, `rapports.ts`, `utilisateurs.ts`
- Modifier : `src/content/guide/index.ts`

- [ ] **Étape 1 : `depenses.ts`** — `id: 'depenses'`. Appuis CDC : `280` (Dépenses ✅).
  Étapes : enregistrer une dépense · les catégories · les budgets par catégorie · comparer
  budget et réel.
  ⚠️ Dire que la comparaison « Budget vs Réel » porte sur **la même période des deux côtés** —
  c'est le défaut qui a été corrigé, et le manuel ne doit pas laisser croire l'inverse.

- [ ] **Étape 2 : `rapports.ts`** — `id: 'rapports'`. Appuis CDC : `281-282`, `284`
  (rapports ✅ · prévisions et objectifs ✅ · export CSV/XLSX/PDF ✅, « voir la réserve §9.1 »).
  Étapes : lire le rapport de ventes · la répartition par mode de paiement · le CA par
  catégorie · exporter.
  ⚠️ **La réserve §9.1 est la TRONCATURE des exports** : un export volumineux ne rend que les
  N lignes les plus récentes, et **le nom du fichier le dit**
  (`ventes-JJ-10000-sur-42130.csv`). Le manuel doit l'écrire — un commerçant qui somme un
  export tronqué sans le savoir obtient un chiffre faux.
  ⚠️ Dire que « Autres » du camembert par catégorie porte son **effectif** (« Autres — 4
  catégories »), sinon le lecteur ne sait pas s'il regarde une catégorie ou quatorze.

- [ ] **Étape 3 : `utilisateurs.ts`** — `id: 'utilisateurs'`. Appuis CDC : `291` (6 rôles et
  matrice de permissions ✅), `290` (multi-boutiques ✅), `292` (journal d'activité ✅).
  Étapes : inviter un utilisateur · les six rôles et ce que chacun voit · changer de boutique ·
  consulter le journal d'activité.
  ⚠️ **Les six rôles sont ceux du CDC** : ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT, HR, CASHIER.
  Ne pas en inventer un septième ni renommer les existants dans le texte.
  ⚠️ **`SUPER_ADMIN` est un rôle INTERNE à la boutique**, pas un accès à la plateforme — ne
  jamais laisser entendre qu'il donne accès à la console `/admin` : c'est la confusion qui a
  causé une fuite inter-tenants, corrigée.

- [ ] **Étape 4 : brancher, vérifier, commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx tsc --noEmit && npx vitest run src/tests/guidePage.test.tsx
git add apps/frontend/src/content/guide
git commit -m "feat(guide): sections Dépenses, Rapports, Utilisateurs & rôles

La section Rapports écrit la troncature des exports : un export volumineux ne
rend que les N lignes les plus récentes et le NOM DU FICHIER le dit. Un
commerçant qui somme un export tronqué sans le savoir obtient un chiffre faux
— le manuel serait complice de le taire.

La section Utilisateurs dit que SUPER_ADMIN est un rôle INTERNE à la boutique
et ne donne aucun accès à la console plateforme : c'est la confusion qui avait
causé une fuite inter-tenants.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 4 : le verrou « rien qui ne soit ✅ » + liens + SEO + release

**Fichiers**
- Créer : `src/tests/guideClaims.test.ts`
- Modifier : `src/components/landing/LandingFooter.tsx`, `landingShared.ts`, `scripts/seo/sitemap.xml.tmpl`
- Créer : `src/content/guide/reglages.ts` (8ᵉ section) + `index.ts`

- [ ] **Étape 1 : le verrou, DÉRIVÉ du CDC — écrire le test d'abord**

```ts
// apps/frontend/src/tests/guideClaims.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { GUIDE_SECTIONS } from '@/content/guide'

/**
 * LE MANUEL NE DOCUMENTE QUE CE QUI EST ✅.
 *
 * ⚠️ Le périmètre est DÉRIVÉ du CDC, jamais recopié : le jour où une capacité passe de ✅ à
 * ⚠️ (une clé expire, un prestataire tombe), ce verrou rougit tout seul. Une liste écrite à
 * la main resterait verte et le manuel continuerait d'affirmer.
 *
 * ⚠️ Lecture à l'EXÉCUTION (`readFileSync`), pas par `import` : le CDC vit dans `docs/`, hors
 * du périmètre de compilation — c'est la convention des fixtures partagées du dépôt.
 */

const CDC = readFileSync(join(process.cwd(), '..', '..', 'docs', 'HabaShop_CDC_v4.md'), 'utf-8')

/** Libellés des lignes de tableau dont l'état n'est PAS ✅. */
function capacitesNonAtteignables(): string[] {
  const out: string[] = []
  for (const ligne of CDC.split('\n')) {
    if (!ligne.startsWith('|')) continue
    const cellules = ligne.split('|').map(c => c.trim())
    if (cellules.length < 3) continue
    const libelle = cellules[1].replace(/\*\*/g, '').trim()
    const reste = cellules.slice(2).join(' ')
    if (!libelle || libelle.startsWith('---') || /^[✅⚠️🧪⬜]/.test(libelle)) continue
    const nonOk = /[⚠🧪⬜]/.test(reste) && !/✅/.test(reste)
    if (nonOk && libelle.length > 3) out.push(libelle)
  }
  return out
}

/** Termes qu'un libellé non atteignable rend interdits dans le manuel. */
const EXEMPTIONS_NOMMEES = new Set([
  // Un libellé de CDC trop générique produirait des faux positifs. Chaque exemption est
  // NOMMÉE et justifiée — jamais une liste fourre-tout.
  'Enterprise',        // un palier tarifaire, pas une capacité du manuel
])

const texteDuManuel = GUIDE_SECTIONS.flatMap(s => [
  ...Object.values(s.titre), ...Object.values(s.intro),
  ...s.etapes.flatMap(e => [...Object.values(e.titre), ...Object.values(e.corps)]),
]).join(' \n ').toLowerCase()

describe('guideClaims', () => {
  it('COUVERTURE : le scan trouve des capacités non atteignables dans le CDC', () => {
    // Un parseur cassé rendrait une liste vide, donc un vert qui ne garde rien.
    expect(capacitesNonAtteignables().length).toBeGreaterThanOrEqual(5)
  })

  it('TÉMOIN POSITIF : le scan voit bien les capacités inertes connues', () => {
    const noms = capacitesNonAtteignables().join(' | ')
    expect(noms).toMatch(/hors-ligne/i)
    expect(noms).toMatch(/Import de produits/i)
  })

  it('⚠️ le manuel ne mentionne AUCUNE capacité non atteignable', () => {
    const fautes = capacitesNonAtteignables()
      .filter(c => !EXEMPTIONS_NOMMEES.has(c))
      .filter(c => texteDuManuel.includes(c.toLowerCase()))
    expect(fautes, `capacités non atteignables citées par le manuel : ${fautes.join(', ')}`).toEqual([])
  })

  it('⚠️ ni les prestataires de paiement en bac à sable ou sans clés', () => {
    for (const p of ['wave', 'orange money', 'paydunya', 'campay', 'mtn momo']) {
      expect(texteDuManuel, `« ${p} » n'est pas encaissable aujourd'hui`).not.toContain(p)
    }
  })

  it('⚠️ ni les canaux inertes faute de clés (SMS, push)', () => {
    expect(texteDuManuel).not.toMatch(/\bpar sms\b/)
    expect(texteDuManuel).not.toMatch(/notification[s]? push/)
  })

  it('les HUIT sections attendues sont présentes', () => {
    expect(GUIDE_SECTIONS.map(s => s.id).sort()).toEqual(
      ['caisse', 'clients', 'codes-barres', 'depenses', 'rapports', 'reglages', 'stock', 'utilisateurs'],
    )
  })
})
```

⚠️ **Le chemin du CDC dépend du répertoire de lancement de vitest.** Vérifier `process.cwd()`
dans l'environnement réel (il vaut `apps/frontend` quand on lance depuis ce workspace) et
ajuster ; si le chemin est faux, le `readFileSync` lève et le test rougit **bruyamment** —
c'est le bon comportement, jamais un `try/catch` qui rendrait une liste vide.

- [ ] **Étape 2 : écrire `reglages.ts` (8ᵉ section) et corriger ce que le verrou signale**

`id: 'reglages'`. Appuis CDC : `290-291` pour le contexte, et les réglages de boutique
(devise, pays, TVA, langue, thème). Étapes : renseigner sa boutique · devise et pays · le taux
de TVA · la langue et le thème · les notifications par e-mail.
⚠️ **Notifications : e-mail SEULEMENT.** `CDC:295-297` donne le push web ⚠️ (clés VAPID
absentes), le push mobile ⚠️ (application non publiée) et les alertes SMS ⚠️ (clé absente). Les
trois sont inertes — le verrou de l'étape 1 les refuse, et c'est voulu.
⚠️ **La TVA se dérive du pays** : ne pas écrire de taux en dur dans le texte. Un taux écrit
dans une phrase redevient faux, dans quatre langues, au premier changement de loi.

Puis lancer le verrou et **corriger le MANUEL**, jamais assouplir le verrou :

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/guideClaims.test.ts
```

- [ ] **Étape 3 : lien dans le pied de page + libellé ×4**

Dans `landingShared.ts`, ajouter `guide` à `footer_links` dans les **quatre** blocs :
`'Manuel d’utilisation'` · `'User guide'` · `'Manual de uso'` · `'Manuale d’uso'`.

Dans `LandingFooter.tsx`, ajouter à la liste des liens (qui porte déjà `privacy`, `terms`,
`legal`) :
```ts
              { cle: 'guide' as const, to: '/guide', externe: false },
```
⚠️ La clé est **stable** et la cible explicite — c'est la leçon du fichier : trois liens y
étaient des `href="#"` qui ne menaient nulle part.

Puis vérifier le rendu **à 360 px sur le DOM rendu**, pas dans la source :
```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npm run e2e:density
```
⚠️ Un lien de plus au pied de page peut faire déborder ou s'enrouler. L'espagnol et l'italien
rallongent — si ça casse, corriger la **contrainte** (passer les liens en colonne), jamais
raccourcir le libellé.

- [ ] **Étape 4 : ajouter `/guide` au sitemap**

Dans `apps/frontend/scripts/seo/sitemap.xml.tmpl`, avant `</urlset>` :

```xml
  <!-- Manuel d'utilisation -->
  <url>
    <loc>{{APP_URL}}/guide</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
```

- [ ] **Étape 5 : les gardes d'ARTEFACT (le `dist/` décide, pas la source)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend
npm run build
npm run verify:seo-urls
npm run verify:classes
npm run verify:demo-flag
npm run verify:sw-routes
grep -c "/guide" dist/sitemap.xml
```
⚠️ `verify:classes` inspecte le `dist/` **JS compris** : toute classe utilisée par `Guide.tsx`
doit exister dans `index.css`. ⚠️ **Tailwind n'émet RIEN** dans ce projet — une classe
`sm:`/`lg:` écrite dans un `className` est **morte**. Toute variante responsive de la page
s'écrit à la main dans `index.css`, aux points de rupture 640/1024.
Attendu du `grep` : `1`.

- [ ] **Étape 6 : rituel complet, bump, push**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx tsc --noEmit && npx vitest run
cd /Users/nelson/Documents/Projets/habashop
npm run lint --workspaces
npm version minor --no-git-tag-version
npm run build --workspace=apps/backend   # régénère version.generated.ts
git add -A
git commit -m "feat(guide): manuel d'utilisation public — 8 modules, 4 langues

Le verrou guideClaims DÉRIVE du CDC v4 au lieu de recopier une liste : le jour
où une capacité passe de ✅ à ⚠️, il rougit tout seul. Une liste écrite à la
main resterait verte et le manuel continuerait d'affirmer.

⚠️ Périmètre corrigé : « Mobile & hors-ligne » a été REMPLACÉ par
« Utilisateurs & rôles ». CDC:251 donne la vente hors-ligne ⚠️ « mobile
uniquement, et l'application n'est publiée nulle part » — la documenter serait
décrire une capacité que personne ne peut utiliser.

Aucun prestataire de paiement n'est présenté comme encaissable : les cinq sont
en bac à sable ou sans clés. Aucune notification hors e-mail : push web, push
mobile et SMS sont inertes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```
⚠️ **Après le push : ne rien lancer.** `main` auto-déploie sur les deux plateformes.
Vérifier un déploiement Vercel `● Ready` **postérieur** au merge, puis, en lecture seule :
L'URL publique se lit dans `apps/frontend/.env.production` (`VITE_APP_URL`) — ne pas la
recopier ici, ce plan se périmerait :

```bash
set -euo pipefail
APP=$(grep -E '^VITE_APP_URL=' apps/frontend/.env.production | cut -d= -f2- | tr -d '"' | sed 's#/*$##')
curl -s -o /dev/null -w "%{http_code}\n" "$APP/guide"
curl -s "$APP/sitemap.xml" | grep -c "/guide"
```
Attendu : `200` puis `1`. ⚠️ Si le `sitemap.xml` déployé rend `0` alors que le `dist/` local
en contenait 1, c'est l'ARTEFACT servi qui diffère — relire `verify:seo-urls`, pas le gabarit.
