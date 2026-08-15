# Paie — les règles du chantier

> ⚠️ **DÉPLACÉ DE `CLAUDE.md` LE 2026-08-15, SUR DÉCISION DE NELSON.** Ces règles ne se chargent
> plus à chaque session ; le déclencheur resté dans `CLAUDE.md` dit quand venir ici.
> **À LIRE AVANT de toucher** `payrollShared`, `utils/payroll.ts`, `payrollDisplay`, `PayrollGrid`, `PayrollPayslips`, `printBulletin` ou l'une des 5 surfaces d'affichage.
>
> Texte repris **VERBATIM** — aucune reformulation, pour qu'aucune nuance ne se perde au passage.

### Paie ⚠️ — bulletins PERSISTÉS, instantané GELÉ

📖 *POURQUOI intégral (les deux règles de retenues incompatibles — 150 000 imprimé contre 130 500 affiché —, les trois temps de la correction de conversion, le verrou tout négatif aveugle au « zéro fois », les cas dorés chiffrés) : `docs/lessons/paie-conversion-et-gel.md`* — **à lire AVANT** de toucher `payrollShared`, `utils/payroll.ts`, `payrollDisplay`, `PayrollGrid`, `PayrollPayslips`, `printBulletin` ou l'une des 5 surfaces d'affichage.

📖 *Modèle `Payroll`, routes, miroir des rôles, idempotence de la génération et `paidAt` serveur : `docs/modules.md` § Paie.*

⚠️ **INSTANTANÉ GELÉ — c'est l'INVERSE de la règle Abonnements**, et c'est délibéré. Un abonnement ne stocke aucun total (« au tarif du jour ») ; un bulletin de paie FIGE `baseSalary/bonus/overtime/deductions/absences/net` **et le nom de l'employé** au moment de la génération. Une augmentation en août ne doit pas réécrire ce qui a été versé en juin — sinon la paie passée devient irrécupérable et l'export comptable ment rétroactivement. Ne jamais « simplifier » en joignant `Employee.salary` à l'affichage. ⚠️ **`Payroll.cnss` et `Payroll.ir` sont GELÉS** comme `net` : ils dépendent de taux **légaux**, donc les recalculer à l'affichage rejouerait un bulletin passé au barème du jour. Geler `baseSalary` sans geler `cnss` ne suffit pas. (La pénalité d'absence, elle, se redérive des champs gelés + la constante de 26 jours.)

⚠️ **`month` = clé ISO `YYYY-MM`, JAMAIS le libellé d'écran** (« Juillet 2026 »). Une clé qui dépend de la langue d'affichage rend les données illisibles au changement de locale et fait écrire des mois incompatibles à deux tenants en langues différentes. Conversion côté front (`monthKey`, rend `null` sur l'irreconnaissable — **jamais un mois par défaut**, un repli silencieux écrirait la paie sur le mauvais mois) ; le serveur **refuse** tout le reste en 400.

**Retenues ⚠️ SOURCE UNIQUE `payrollShared.payrollBreakdown`** (miroir back `utils/payroll.ts`, cas partagés `payroll-net-cases.json`) : **CNSS 8 % + IR 5 % assis sur le BRUT** (base+primes+heures sup), **tous deux DÉDUITS** ; `deductions` = retenues **EXCEPTIONNELLES** (avance, casse) qui s'**AJOUTENT** aux cotisations ; pénalité d'absence = `round(absences × base / 26)`. ⚠️ **Les taux ne vivent QUE dans `CNSS_RATE`/`IR_RATE`** — jamais en dur, jamais dans un libellé i18n (un taux écrit dans la chaîne redevient faux dans 4 langues au premier changement de loi).

⚠️ **CONVERTIR UNE FOIS — `payrollDisplay(record, currency)` puis `fmtDisplay`.** Le calcul vit en XOF, l'affichage peut être à 2 décimales : convertir chaque ligne PUIS le total séparément donne un bulletin **qui ne s'additionne pas**. **Règle : total = SOMME des lignes arrondies · net = brut − total**, gains inclus. Les valeurs rendues sont **DÉJÀ CONVERTIES** → `useFormatAmount`/`formatAmount`/`convertFromXOF`/`convertAmount` sont **INTERDITS** sur toute surface de paie (double conversion), et `payrollBreakdown` (XOF) n'est plus utilisé pour afficher. **Les 5 surfaces y passent** : page Paie (table + KPI + totaux), bulletin PDF, modale bulletin, cartes RH `PayrollPayslips`, grille RH `PayrollGrid`. ⚠️ **Un local qui porte des XOF se suffixe `Xof`** — deux locaux de même nom et d'unités différentes ont coûté une soustraction d'euros à des francs CFA.

⚠️ **UN SEUL générateur de bulletin : `printBulletin`** (l'onglet RH passe par l'adaptateur `payRecordFromEmployee` + `labelFromMonthKey`). Ne pas recréer un template : le méta-test rougit si un fichier consommant le détail de paie ouvre un document. **Logo — `LogoMark` est la seule source.**

**Verrous** : `payrollPersistence.test.ts` (20, dont augmentation-postérieure et bulletin-déjà-payé) · `payrollDisplayCoherence.test.ts` (12, cas doré + les 6 devises, 2 sabotages) · `payrollConvertOnce.test.ts` (15, règle POSITIVE incluse — *un verrou tout négatif est aveugle au « zéro fois »* — 5 sabotages inline + 2 réels) · `payrollFrozenNet.test.ts` · `payrollNetShared.test.ts` (jumeaux front/back sur le fixture) · `payroll-calc.test.ts`. **Sabotages vérifiés dans les deux sens** : ancien taux côté front seul → 8 rouges ; déduction retirée côté back seul → 8 rouges.

