# `e2e/dev/` — specs qui exigent le SERVEUR DE DÉVELOPPEMENT

Tout spec placé ici est **exclu de la suite de production** (`npm run e2e`) et joué
uniquement par `npm run e2e:density`, qui démarre `vite dev`.

## Pourquoi un DOSSIER et pas une liste de noms

⚠️ Le 2026-08-06, `dev-table-density.spec.ts` a été déposé à la racine d'`e2e/`. La config de
production a `testDir: './e2e'` et n'ignorait que `auth.setup.ts` : elle l'a donc ramassé —
**43 cas en 21 fichiers au lieu de 39 en 20** — et l'aurait joué contre la PRODUCTION, où le
harnais `/__dev/table` n'existe pas PAR CONCEPTION (`import.meta.env.DEV`). Quatre échecs
garantis, sur un défaut introduit par le correctif lui-même.

Ajouter `dev-table-density` au `testIgnore` aurait marché **ce jour-là**, et cassé au
deuxième harnais. L'exclusion porte donc sur le DOSSIER : elle ne peut pas se périmer à
l'ajout d'un fichier. C'est la même règle que « périmètre DÉRIVÉ, jamais listé ».

## Règle

Un spec va ici **si et seulement si** il dépend de quelque chose qui n'existe qu'en dev :
harnais gardé par `import.meta.env.DEV`, route de mesure, page de débogage.
Un spec qui vise la production reste à la racine d'`e2e/`.
