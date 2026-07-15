# Tests

Guide d'organisation et d'écriture des tests. Objectif : qu'un nouveau contributeur sache où
ajouter un test, sous quelle forme, et comment mesurer la couverture.

## Lancer les tests

```bash
make test          # toute la suite, une fois (vitest run)
make test-watch    # mode watch (relance sur modification)
make coverage      # rapport de couverture (résumé console + HTML dans coverage/)
```

Runner : **Vitest**. Environnement : **jsdom** (configuré globalement dans `vite.config.ts`), donc
les tests de vue tournent sans navigateur. Alias `@core`, `@data`, `@ui`, `@app` disponibles dans
les tests comme dans le code.

## Organisation

Les tests sont **co-localisés** avec le code : `foo.ts` → `foo.test.ts` dans le même dossier. Deux
familles :

- **Tests de cœur** (logique pure) : le gros de la valeur. Le moteur, la magie, la sérialisation, la
  traduction des règles et la validation du catalogue sont testés sans DOM.
- **Tests de vue** (composants React) : garde-fous de rendu et d'interaction, avec React Testing
  Library + jsdom.

Fichiers de référence à imiter :

| Cible | Fichier | Ce qu'il montre |
| --- | --- | --- |
| Moteur | `src/core/engine/evaluate.test.ts` | fixtures `inst` / `makeList`, assertions sur coût/issues/effets |
| Magie | (dans `evaluate.test.ts`) | `pageAllocation`, `maxPagesInPool`, affinité |
| Catalogue | `src/data/catalog.test.ts` | intégrité + parse Zod |
| Sérialisation | `src/app/io/listCode.test.ts`, `listText.test.ts` | round-trip code/texte |
| Logique de vue extraite | `src/app/builder/roster.test.ts` | sections de sidebar + montures, **sans** rendu |
| Composant (props purs) | `src/app/builder/ProfileStatCard.test.tsx` | snapshots de rendu |
| Écran avec état interne | `src/app/AdminCatalog.test.tsx` | navigation par onglets, requêtes par rôle |
| Kit UI | `src/ui/kit.test.tsx` | composants partagés |

## Tests de cœur (logique pure)

Importer le catalogue réel (`@data`) ou construire une petite liste et appeler le moteur. Le
fichier moteur fournit des fabriques réutilisables :

```ts
import { catalog } from "@data";
import { evaluateList } from "@core"; // ou "../engine/evaluate"

// inst(profileId, over?) -> ProfileInstance ; makeList(members, factionId?) -> ListDocument
const res = evaluateList(catalog, makeList([inst("guilde-noire-mathys-3")], "kharns"));
expect(res.issues.filter((i) => i.ruleId?.startsWith("faction:"))).toHaveLength(1);
```

Règle d'or : quand une logique de vue devient testable en soi (catégorisation, calcul), **l'extraire
en fonction pure** (typiquement dans `shared.ts`) et la tester là, plutôt que de piloter le composant.
`roster.test.ts` est né de cette extraction (`rosterSectionOf`, `availableMountTypeIds`).

## Tests de vue (React Testing Library)

Patron minimal :

```tsx
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup); // nettoie le DOM entre les cas

it("rend et réagit", () => {
  render(<MonComposant prop={valeur} />);
  expect(screen.getByRole("heading", { name: /Titre/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Objets" }));
  expect(screen.getByText(/\+ équipement/i)).toBeTruthy();
});
```

Bonnes pratiques :

- **Requêter par rôle ou texte** (`getByRole`, `getByText`) plutôt que par classe CSS : on teste ce
  que voit l'utilisateur, pas le balisage interne.
- **Préférer les assertions ciblées** (présence d'un titre, d'un bouton, d'une valeur) aux snapshots.
  Réserver les **snapshots** au rendu qu'on veut figer volontairement (ex. `ProfileStatCard`) - un
  diff de snapshot doit signaler un changement visuel à valider, pas du bruit.
- Les écrans qui gèrent leur **propre état** (ex. `AdminCatalog` via `useCatalogStore`) se rendent
  directement, sans provider ; naviguer avec `fireEvent.click` sur les onglets.
- Nettoyer avec `afterEach(cleanup)` et, si le composant écrit dans `localStorage`/Dexie, isoler ou
  réinitialiser l'état.
- Descriptions de test **en français**, comme le reste du code.

## Couverture

`make coverage` (provider v8) produit un résumé console et un rapport HTML dans `coverage/`
(`coverage/index.html`, non versionné). Aucun **seuil bloquant** n'est configuré : la couverture est
un outil de mesure, pas une barrière de CI - à faire évoluer si l'équipe le décide.

État : le **cœur métier est largement couvert** ; la couche **vue reste partielle**. Priorités
d'extension (gros fichiers encore peu ou pas testés) :

- `src/app/builder/FigureEditor.tsx` - éditeur de figurine (équipement, magie, améliorations) : le
  plus gros trou restant.
- `src/app/RuleEditors.tsx` - éditeurs de contraintes/effets de l'admin.
- `src/app/builder/BuilderScreen.tsx` - la logique pure est testée (`roster.test.ts`) ; le rendu ne
  l'est pas encore.
- `src/app/builder/MountDialog.tsx`, `OstPanel.tsx`.

Déjà couverts par des tests de vue (à imiter) : `AdminCatalog` (tous les onglets, y compris les pages
de détail admin), `FactionSelect`, `PurchaseSummary`, `ProfileStatCard`.

Pour chacune, commencer par un test de **rendu sans erreur** (déjà une couverture utile), puis les
interactions clés.
