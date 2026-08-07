# Les tests qui FIGENT au lieu d'affirmer — purge du 2026-08-06

*Chantier CLOS. Cette page porte le récit, les chiffres et les cas nommés ; la règle survivante
vit dans `CLAUDE.md` (§ Tests).*

**À lire avant** d'entreprendre une purge de suite de tests, ou de « réparer » un test qui
n'assert rien.

---

## Le mécanisme

*Le test décrit ce que le code FAIT au lieu d'affirmer ce qu'il DOIT faire.* Invisible tant que
le comportement est juste ; le jour où il devient faux, **le test protège le défaut**.

**Résultat de la purge : −58 cas** (back 1119 → 1083, front 989 → 978).

**Critère de succès d'une telle purge : le total DOIT baisser.** Un test qui n'affirme rien se
**supprime**, il ne se répare pas — le réparer invente une couverture que personne n'a demandée
sur un code que personne n'a jugé prioritaire de tester ; le supprimer rend le chiffre honnête.

## La signature la plus grave — et elle n'était dans aucune liste

Un cas qui ne touche la production **par aucun moyen** : ni `import`, ni `readFileSync`, ni
`app.inject`, ni `render`.

| Fichier | Ce qu'il contenait |
|---|---|
| `routes.test.ts` | **28 cas sur 36**, dont `expect(typeof q.where.email).toBe('string')` pour prouver « Prisma protège de l'injection SQL » |
| `auth.test.ts` | `it('true is true')` |
| `mtn-normalize.test.ts` | une **copie manuelle** de `normalizeCameroonPhone`, assumée en commentaire — sur le numéro qui REÇOIT un paiement MTN |

La copie de `mtn-normalize` a été extraite dans `lib/msisdn.ts` puis supprimée ; les 19 cas
repassent verts contre la vraie fonction, donc **elles n'avaient pas encore divergé**.

**Le tort n'est pas de rater une régression.** C'est que **le TITRE dissuade d'écrire le vrai
test** : « l'isolation multi-tenant ? c'est déjà couvert » — elle l'est, mais par
`tenantIsolation.test.ts`, pas par eux.

## Deux limites de la détection, à ne pas laisser croire couvertes

1. **Le critère « ne touche pas la production » est STRUCTUREL.** Un test qui importe un symbole
   puis assert à côté de la plaque passe au travers — les 14 cas de `components.test.tsx`
   utilisant `formatInCurrency` n'ont **PAS** été vérifiés sur ce point. **66 était un PLANCHER,
   pas un total.**
2. **La signature « libellé figé deux fois » n'a pas été balayée largement.** Distinguer
   « libellé que le test OBSERVE » de « libellé que le test IMPOSE » demande une heuristique
   qu'on n'a pas ; un balayage naïf rend des centaines de faux positifs (chaque
   `getByText('Enregistrer')` légitime).

## Le REPROCHE ANTICIPÉ — suite directe du CTA désactivé

On avait retiré l'**EMPÊCHEMENT** (bouton éteint), pas le **REPROCHE**.

`ValidatedInput` posait `touched` sur tout `blur` : or les modales **autofocusent leur premier
champ**, donc le simple fait de cliquer ailleurs affichait « Ce champ est requis » sur un champ
que l'utilisateur n'avait jamais choisi de visiter.

⚠️ **La description initiale disait « au montage » — MESURÉ, c'est FAUX** : au montage le message
est absent, il apparaît au premier `blur`. **Corriger le symptôme décrit aurait manqué la cause.**

Désormais `touched` exige une SAISIE réelle (ou une valeur préexistante) ; la soumission reste
couverte par le refus explicite des modales. Verrou : `hrContractDomain.test.ts` (sabotage
vérifié).

## Le bandeau qui criait toujours

« Modifications non sauvegardées » s'affichait dès l'ouverture du mode édition, avant tout
changement. *Une alerte qui crie toujours n'alerte plus quand elle devient vraie.* Deux états
distincts (« Mode édition » / « … — modifications non sauvegardées »), comparés à un instantané
pris à l'entrée en édition.
