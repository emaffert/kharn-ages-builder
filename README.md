# Khârn-Âges — Constructeur de listes

Application web (PWA, local-first) de création de listes pour le jeu de figurines
**Khârn-Âges**.

## Stack

React + TypeScript + Vite + Tailwind CSS. Voir [`docs/stack-technique.md`](docs/stack-technique.md).

## Documentation

- [`docs/regles-creation-liste.md`](docs/regles-creation-liste.md) — règles métier (source de vérité).
- [`docs/schema-donnees.md`](docs/schema-donnees.md) — modèle de données et architecture.
- [`docs/stack-technique.md`](docs/stack-technique.md) — choix techniques.

## Développement

Prérequis : Node 20+ (le projet est développé sous Node 26).

```bash
npm install      # installer les dépendances
npm run dev      # serveur de développement
npm run build    # build de production
npm run typecheck
```

## Structure

```text
src/
  core/   # cœur métier (TS pur) : modèle, moteur de contraintes/effets, calcul de coût
  data/   # catalogue JSON
  ui/     # composants React
  app/    # écrans + navigation
```
