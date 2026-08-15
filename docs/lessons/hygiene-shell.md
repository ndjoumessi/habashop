# Les cinq faux zéros — pourquoi toute commande composée commence par `set -euo pipefail`

> **La règle vit dans `CLAUDE.md` § Commandes courantes.** Cette page porte les MESURES qui
> l'ont produite : les cinq formes exactes, ce que chacune a rendu, et pourquoi aucune n'était
> visible à la relecture. À lire quand on doute d'une sortie vide — pas à chaque session.

Le 2026-08-07, **cinq faux zéros en vingt-quatre heures**. Cinq formes différentes, un seul
symptôme : une sortie vide qui se lit comme un résultat propre. Aucune n'a produit d'erreur
visible ; trois ont failli être rendues comme des conclusions.

| Forme | Ce qui s'est passé |
|---|---|
| `--include=*.ts` non quoté | zsh a mangé le glob → « 0 correspondance » sur trois workspaces |
| `for f in $CIBLES` | zsh ne découpe PAS une variable non quotée → « 0/15 fichiers » |
| `xargs grep -nP` | `xargs` appelle le `grep` **BSD** (sans `-P`), pas l'`ugrep` du shell → erreur affichée, **exit 0**, sortie vide |
| `cd apps/backend` déjà appliqué | chemins relatifs non résolus → « aucune occurrence dans les fichiers de paie », faux |
| `cd apps/frontend` en échec | la commande suivante a tourné dans le MAUVAIS répertoire, et son résultat plausible a failli être rendu |

## Ce que chaque garde achète

`set -e` fait qu'un `cd` en échec **interrompt** au lieu de laisser la suite s'exécuter
ailleurs. `pipefail` fait qu'une commande qui échoue dans un pipe fait échouer le pipe —
c'est le `npx tsc | tail` qui rendait « exit=0 » sur deux erreurs de type. `-u` fait
qu'une variable non définie interrompt plutôt que de se substituer par du vide. Les
guillemets font que le shell ne décide pas à votre place de ce qui est un mot.

Les quatre gardes ont été **vérifiées dans ce shell**, pas supposées.

## Le trait commun, qui vaut au-delà du shell

Ces cinq formes ne partagent pas une cause technique — elles partagent une **silhouette de
sortie**. Un zéro. Et un zéro ressemble exactement à ce qu'on espère quand on cherche un
défaut : « il n'y en a pas ». C'est ce qui les rend indétectables à la relecture et ce qui
impose le **contrôle positif** — la commande doit d'abord trouver un cas qu'on sait présent,
sinon son zéro ne prouve rien.

## Les deux pièges de l'adoption

Ils sont dans `CLAUDE.md` parce qu'ils mordent à l'écriture, pas au diagnostic :

- sous `set -e`, un `grep` **sans correspondance** sort en 1 et interrompt le script — or
  « rien trouvé » est parfois la bonne réponse. D'où `n=$(grep … | wc -l || true)`. Et ce
  `|| true` rouvre la porte au masquage d'un scan cassé : le contrôle positif redevient
  obligatoire.
- `set -e` est **désactivé** dans un contexte dont le statut est testé — `( cmd ) || echo …`,
  `if cmd`, `cmd && …`. Une vérification de `set -e` écrite sous cette forme ne mesure rien.
  C'est arrivé au premier essai de vérification, et le test annonçait le contraire de la réalité.
