# Leçon — Paie : le gel du bulletin, et « convertir une fois »

> Extrait de `CLAUDE.md` le 2026-08-07 pour l'alléger. **Rien n'a été supprimé** : ce fichier
> est le POURQUOI intégral — les deux règles de retenues incompatibles, les trois temps de la
> correction de conversion, le verrou tout négatif aveugle au « zéro fois », et les cas dorés
> chiffrés. Le QUOI opérationnel — les invariants (`payrollDisplay` + `fmtDisplay`, gel de
> `cnss`/`ir`, `printBulletin` unique) — reste dans `CLAUDE.md` § Paie, qui pointe ici.
> **À lire AVANT** de toucher `payrollShared`, `utils/payroll.ts`, `payrollDisplay`,
> `PayrollGrid`, `PayrollPayslips`, `printBulletin` ou l'une des 5 surfaces d'affichage.

---

## 1. Les DEUX règles de retenues incompatibles — et le PDF appliquait la mauvaise

⚠️ **IL Y AVAIT DEUX RÈGLES INCOMPATIBLES, et le bulletin PDF appliquait la mauvaise.**
Mesuré le 2026-07-30 : `payrollShared` calculait CNSS **5,6 % du salaire de BASE** avec un
**IRPP résiduel**, et **ni l'un ni l'autre ne réduisait le net** (simple ventilation
d'affichage de `deductions`) ; `PayrollGrid`/`PayrollPayslips` déduisaient bien 8 %+5 % du
brut. Sur 150 000 XOF sans prime : **150 000 imprimé par le PDF contre 130 500 affiché par
l'onglet RH** — deux nets pour le même salaire, sur un document remis à l'employé. Le
commentaire de `PayrollGrid` se déclarait « source unique (cf. payroll-calc) » alors que
payroll-calc divergeait : **un doublon qui s'affirme canonique est pire qu'un doublon
assumé**, il décourage la vérification.

⚠️ **Les taux ne vivent QUE dans `CNSS_RATE`/`IR_RATE`** — jamais en dur, jamais dans un
libellé i18n (« CNSS (5,6 %) » redevenait faux dans 4 langues au premier changement de loi ;
le taux est rendu depuis la constante). **6 fichiers** codaient `0.08`/`0.05`/`0.87` en dur
(`PayrollGrid`, `PayrollPayslips`, `EditEmployeeModal`, `NewContractModal`,
`ContractDetailModal`, `HR.tsx`) : tous importent désormais la source. Deux bugs révélés au
passage — le KPI « Net à payer » de `PayrollGrid` valait `brut × 0.92` (il ne retirait
**que** la CNSS, jamais l'IR, contredisant sa propre table), et sa ligne de TOTAL appliquait
les taux à la **masse globale** alors qu'un arrondi global ≠ la somme des arrondis par
bulletin — or c'est le bulletin qui est versé.

## 2. Cohérence arithmétique du document — le bulletin qui ne s'additionne pas

⚠️ **COHÉRENCE ARITHMÉTIQUE DU DOCUMENT — `payrollDisplay(record, currency)`.** Le calcul vit
en XOF ; l'affichage peut être en EUR/USD/… à 2 décimales. Convertir chaque ligne PUIS le
total séparément donne un bulletin **qui ne s'additionne pas**. MESURÉ sur 350 000 XOF en EUR
(parité 655,957) : lignes CNSS 42,69 + IR 26,68 = **69,37**, alors que convertir le total XOF
(45 500) donne **69,36** ; net `brut − total` = **464,20**, alors que convertir le net XOF
(304 500) donne **464,21**. Un centime — mais l'employé qui additionne les lignes n'obtient
pas le total imprimé. **Règle : total = SOMME des lignes arrondies · net = brut − total**,
gains inclus (`base + primes + heures sup == brut`). En XOF (0 décimale, aucune conversion) le
helper est neutre : le problème n'existe QUE en devise à décimales.

⚠️ Les valeurs rendues sont **DÉJÀ CONVERTIES** → les formater avec
**`fmtDisplay`/`formatInCurrency`**, JAMAIS avec `fmt()`/`useFormatAmount()` qui
reconvertiraient (double conversion — c'est l'exception documentée « valeurs déjà en devise
tenant » du § Règles devise). **Les 5 surfaces y passent** : page Paie (table + KPI + totaux),
bulletin PDF, modale bulletin, cartes RH `PayrollPayslips`, grille RH `PayrollGrid`. Verrou :
`payrollDisplayCoherence.test.ts` (12, cas doré + les 6 devises, **2 sabotages vérifiés** :
total converti au lieu de sommé → 6 rouges ; net converti au lieu de déduit → 6 rouges).

## 3. Convertir UNE fois — corriger surface par surface DÉPLACE le trou

⚠️ **CONVERTIR UNE FOIS — convention EXÉCUTÉE, pas un accident par surface.** Une correction
surface par surface **déplace** le trou au lieu de le fermer : c'est mesuré en trois temps —
(1) chaque surface convertissait elle-même ⇒ lignes ≠ total (69,36 vs 69,37) ; (2)
`payrollDisplay` a corrigé la page Paie **et introduit une DOUBLE conversion** dans le PDF de
l'onglet RH, qui recevait désormais des montants déjà convertis et les repassait dans `fmt`
⇒ sur 280 000 XOF en EUR, **NET 0,57 € au lieu de 371,37 €** ; (3) d'où le méta-test.

**Toute surface de paie appelle `payrollDisplay` et formate par `fmtDisplay`** —
`useFormatAmount`/`formatAmount`/`convertFromXOF`/`convertAmount` y sont INTERDITS, et
`payrollBreakdown` (XOF) n'est plus utilisé pour afficher. Verrou :
`payrollConvertOnce.test.ts` (15) — scan du code exécuté (commentaires **et** imports
retirés), **5 sabotages inline** + **2 sabotages réels vérifiés en dépôt** (reconversion dans
la modale → rouge nominatif ; taux en dur dans une carte RH → rouge). ⚠️ Il a trouvé **deux
trous dans le correctif lui-même** : le CSV de `PayrollGrid` convertissait brut/bonus par un
`cv()` local pendant que cnss/ir/net venaient de `payrollDisplay` (deux chemins d'arrondi dans
la même ligne), et `Payroll.tsx` gardait un `useFormatAmount` mort passé en prop à la modale.

**Cas dorés** : Marie 280 000 XOF/EUR → brut **426,86** · CNSS **34,15** · IR **21,34** ·
total **55,49** · net **371,37** ; Aminata 350 000 → total **69,37** · net **464,20**.

## 4. Un verrou tout NÉGATIF est aveugle au « zéro fois »

⚠️ Les 4 premières règles du méta-test interdisaient de convertir DEUX fois ; aucune n'exigeait
de convertir UNE fois. La cellule BRUT de la Grille rendait donc `fmt(brut)` avec
`brut = Number(emp.salary)||0` (XOF nu) et un `fmt` qui **ne convertit pas** : Marie affichée
**« 280 000,00 € » au lieu de « 426,86 € » — 656×** — pendant que le TOTAL de la colonne était
converti, donc la colonne ne sommait pas à son pied. Les 4 règles restaient **vertes**.

Ajouté : une **règle POSITIVE** (aucune expression d'origine XOF n'atteint un formateur ; on
suit le flux syntaxiquement, locaux teintés inclus) **+ interdiction des formateurs INJECTÉS
PAR PROP** — R1 cherchait le jeton `useFormatAmount` dans le fichier, donc un composant
recevant `fmt` en prop convertissait sans jamais nommer le hook. Elle a immédiatement révélé
**trois bugs de plus** : `EditEmployeeModal` calculait `net = salaryXOF − cnss − ir`, une
**soustraction d'euros à des francs CFA** (426,77 € au lieu de 371,37, soit 55,40 € d'écart) ;
`ContractDetailModal` affichait son brut par un second chemin de conversion ; `PayrollGrid`
avait deux locaux **de même nom et d'unités différentes** (`brut`/`bonus` XOF dans une
closure, EUR dans la ligne) — d'où la convention : **un local qui porte des XOF se suffixe
`Xof`**. Cas dorés étendus : colonne BRUT == brut converti, et somme(colonne) == total affiché
(1 189,10 / 1 034,52 sur trois employés).

⚠️ **Un cas doré XOF double le cas EUR** — non par symétrie, mais parce qu'en XOF (0 décimale,
taux 1) convertir 0, 1 ou 2 fois donne **le même affichage** : tous les défauts de conversion
y sont INVISIBLES, et c'est la devise de la majorité des boutiques. Un jeu EUR seul ferait
croire qu'on couvre la paie alors qu'on ne couvre que le cas rare.

⚠️ Le cas **salaire fractionnaire** (`280 000,5` XOF → 280 001) existe parce qu'un sabotage
l'a exigé : forcer `dec = 2` au lieu de lire `CURRENCY_DECIMALS` ne cassait AUCUN test, tous
les cas XOF étant entiers — or `Employee.salary` est un `Float` et le franc CFA n'a pas de
subdivision. **Un verrou qu'on n'a pas vu échouer peut être vert pour la mauvaise raison.**
Sabotages vérifiés : XOF nu dans la cellule → rouge nominatif ; formateur par prop → 2 rouges.

## 5. Deux défauts historiques, corrigés

⚠️ **`PayRecord.id` était un INDEX DE TABLEAU** (`i + 1`) alors qu'`Employee.id` est un cuid
string : « marquer payé » visait une POSITION, pas une personne — un changement d'ordre de la
liste payait le mauvais bulletin. `PayRecord` porte désormais `employeeId` (cuid) et un `id`
qui est soit le bulletin persisté, soit `pending:<employeeId>` tant qu'il n'existe pas en base.

⚠️ **UN SEUL générateur de bulletin : `printBulletin`.** `HR.tsx` en avait un second
(`generatePayslipPDF`, ~90 lignes) : logo en **TEXTE**, taux écrits en dur dans les libellés,
et un contrat d'entrée **ambigu** — montants XOF depuis « Générer tous », montants déjà
convertis depuis les cartes. Supprimé ; l'onglet RH passe par l'adaptateur
**`payRecordFromEmployee`** + `labelFromMonthKey` (clé ISO → libellé, inverse de `monthKey`).

⚠️ **Logo — `LogoMark` est la seule source.** L'en-tête de la modale Paie dessinait une
**lettre « H » nue** dans un carré translucide, et l'ancien PDF RH écrivait « HabaShop » en
texte : trois rendus pour un logo. Distinct de **#178** (coordonnées du favicon, arrondies à
la main) — ici il n'y avait **aucun asset**.
