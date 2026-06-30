# Stack technique

Décisions de technologie pour l'application. Voir [`schema-donnees.md`](schema-donnees.md)
pour le modèle de données et l'architecture en couches.

## Décisions

- **Langage : TypeScript** partout (garde-fous de typage, essentiel pour le moteur de règles).
- **Interface : React** (écosystème, et meilleure voie de portage mobile).
- **Build : Vite**, application en **SPA** (single-page app) compilée en **fichiers statiques**.
  Préféré à Next.js : pas de besoin serveur (SSR/SEO/comptes) en v1 local-first.
- **Mobile : PWA installable** (icône écran d'accueil + hors-ligne), sans coût ni store.
  Capacitor (stores) ou React Native restent possibles plus tard sans jeter le travail.
- **Local-first** : aucune dépendance serveur en v1. Auth + sync cloud = couche additive ultérieure.
- **Cœur métier en TypeScript pur**, séparé de React (réutilisable web puis mobile).

## Outils

- **Zod** : validation de schéma du catalogue (et garde-fou de l'éditeur admin).
- **Tailwind CSS** : mise en forme.
- **Dexie** (IndexedDB) : sauvegarde locale des listes.
- Compression du code portable (partage de liste) : lib à choisir (impacte la longueur des liens).

## Structure de projet visée

```text
kharn-ages-builder/
  cards/                 # images des cartes (existant)
  rules corpus/          # PDF des règles (existant)
  docs/                  # documentation (existant)
  public/                # manifeste PWA, icônes, assets statiques
  src/
    core/                # CŒUR MÉTIER — TypeScript pur, aucune dépendance UI
      model/             #   types + schémas Zod (catalogue, liste portable)
      engine/            #   validation, résolution des effets, calcul de coût
    data/                # catalogue JSON (factions, profils, équipements, sorts…)
    ui/                  # composants React
    app/                 # écrans + navigation
    main.tsx
  index.html
  package.json / vite.config.ts / tsconfig.json / tailwind.config.ts
```

Règle d'or : `src/core` ne dépend de rien d'autre ; tout le reste dépend de `core`.
