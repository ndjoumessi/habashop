# Le ménage E2E qui n'a jamais tourné — congés, 289 → 307 → 0

*Chantier CLOS le 2026-08-07. Cette page porte le récit et les mesures ; la règle
survivante vit dans `CLAUDE.md` (§ Dette ouverte → 🟡 Medium, et § E2E Playwright).*

**À lire avant** de toucher au ménage d'un scénario Playwright, ou d'écrire un bloc de
nettoyage « best-effort ».

---

## La cause : une clé de stockage qui n'existe nulle part

Le ménage du scénario congés lisait le jeton dans `localStorage.getItem('auth-storage')`.
Cette clé **n'existe nulle part dans le produit** :

| Qui | Clé réelle |
|---|---|
| le store persisté | **`habashop-auth`** (`authStore.ts:187`) |
| les quatre autres scénarios E2E | **`habashop_token`** |
| le ménage des congés | `auth-storage` — inventée |

Le jeton valait donc `''`, le `DELETE` partait en `Bearer ` → **401**, et **aucune ligne n'a
jamais été supprimée**. Mesure qui a mis le doigt dessus : **289 → 307 APRÈS** le correctif
censé stopper la fuite. Le correctif précédent avait traité le symptôme apparent sans que
personne ne vérifie que la suppression aboutissait.

Corrigé : la clé est celle des autres scénarios.

## Pourquoi l'échec était INVISIBLE par construction

Le repli était un `console.warn`, et le rapporteur Playwright n'imprime la sortie d'un test
**réussi** qu'en cas d'échec. **Un test vert n'imprime rien.**

C'est le troisième support du motif « l'absence n'est pas une preuve », après :

1. la coche **verte** du job `notify-failure` sur un run rouge où personne n'était prévenu ;
2. l'`exit 0` d'un scan cassé dont la sortie vide se lit comme un résultat propre.

## Le renversement : un ménage s'ASSERTE

Le bloc était non bloquant « pour ne pas rougir sur du ménage ». Résultat : il a échoué à
**chaque exécution pendant une journée** sans que rien ne le dise.

> *Un ménage silencieux qui ne marche pas est pire que pas de ménage : il fait croire que
> c'est réglé.*

Et l'assertion porte sur **le COMPTE avant/après**, jamais sur le code de retour — un 200 dit
que l'appel a abouti, pas que la base est revenue à son état d'avant. C'est le motif du smoke
de version transposé au nettoyage.

**Prouvé fermé** : trois exécutions consécutives, compte **307 → 307 → 307**. Sabotage
vérifié — retour à `auth-storage` → rouge, avec `GET /api/leave-requests → 401` nommé.

## Limite assumée : les retries rejouent le test entier

Mesuré sur l'exécution CI `31137759378` du 07/08 : **DEUX** demandes créées (01:24:40 et
01:25:37). Une tentative qui échoue avant le bloc de ménage laisse une orpheline, et le
`avant` de la tentative suivante l'inclut. Écrit dans le scénario lui-même.

## La purge du résidu — protocole

**307 → 0** sur `e2e-tenant`, le 2026-08-07, après validation explicite de Nelson.

- répétition à blanc d'abord ;
- garde `CONFIRM=1` ;
- périmètre **en dur dans le script** — *un périmètre passé en argument est un périmètre
  qu'on peut mal taper* ;
- refus si le tenant est `isDemo` ;
- instantané avant, diff de l'objet entier après.

**Effets de bord vérifiés INTACTS** — les 3 `Shift` et les 3 `Attendance` sont inchangés
**id par id** (ce sont les données légitimes d'un congé approuvé, affichées par le Planning),
2 employés, 4 tenants, empreinte `b5c8ead69eaf537c6d5f640b` **inchangée**, et les **7**
demandes de `demo-tenant-001` intactes.

**Cycle E2E réel rejoué APRÈS la purge** : vert, et la base retombe à `LeaveRequest=0`,
`Shift=3`, `Attendance=3` — le ménage tient sur une base propre, pas seulement sur une base
déjà pleine.
