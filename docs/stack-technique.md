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

- **Zod** : validation de schéma du catalogue et des listes (et garde-fou de l'éditeur admin).
- **Système visuel « Forge / Braise »** : couleurs, thèmes clair/sombre et composants sont pilotés
  par des **tokens CSS** (variables `--bone`, `--forge`, `--ember`… dans `src/index.css`) et un kit
  de primitives partagées `@ui` (`Button`, `Tag`, `Dialog`…). **Aucune couleur codée en dur** : le
  builder comme l'admin s'appuient sur ces tokens (l'admin via ses classes `.adm-*`, cf.
  `src/app/admin/admin.css`), donc l'ensemble suit le thème clair/sombre.
- **Tailwind CSS v4** : utilitaires de **mise en page uniquement** (flex, gap, espacements), via le
  plugin Vite `@tailwindcss/vite` (pas de `tailwind.config` ; configuré dans `src/index.css`).
- **Dexie** (IndexedDB) : sauvegarde locale des listes.
- **Vitest** (jsdom) : tests ; **ESLint** : analyse statique.
- **PWA** : `vite-plugin-pwa` génère le service worker et le manifeste (pas de dossier `public/`).
- **Compression du code portable** : *décidée* - API native `CompressionStream` (`deflate-raw`)
  puis encodage base64url, **sans dépendance** (cf. `src/app/io/listCode.ts`). Le JSON étant très
  répétitif, la compression raccourcit fortement le lien.

## Structure de projet

```text
kharn-ages-builder/
  cards/                 # images des cartes (gitignoré ; servi en dev uniquement)
  rules corpus/          # PDF des règles
  docs/                  # documentation de conception
  src/
    core/                # CŒUR MÉTIER - TypeScript pur, aucune dépendance UI
      model/             #   types + schémas Zod (catalogue, liste portable)
      engine/            #   validation, résolution des effets, calcul de coût + magie
    data/                # catalogue JSON (factions, profils, équipements, sorts…) + chargement validé
    ui/                  # kit de composants partagés (Button, Tag, Dialog…), libellés partagés
                         #   (labels.ts) + helpers de présentation (traduction lisible des règles)
    app/                 # écrans + état applicatif
      builder/           #   constructeur de listes (faction, roster, éditeur de figurine)
      admin/             #   éditeur de catalogue (CRUD) - modules par entité, stylé sur .adm-*
      io/                #   persistance Dexie + sérialisation (code/texte) + ids
    main.tsx
  index.html
  package.json / vite.config.ts / tsconfig.json
```

Le manifeste PWA est généré par `vite-plugin-pwa` (config dans `vite.config.ts`) ; il n'y a pas
de dossier `public/` ni de `tailwind.config` (Tailwind v4 se configure dans `src/index.css`).

Règle d'or : `src/core` ne dépend de rien d'autre ; tout le reste dépend de `core`.
