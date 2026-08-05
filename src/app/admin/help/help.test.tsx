// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { catalog } from "@data";
import { SpecialCardDetail } from "../SpecialCardDetail";
import { CardKindHelp, CardScopeHelp } from "./SpecialCardHelp";
import { ConstraintsHelp, EffectsHelp, IdentityHelp, TraitsHelp } from "./ProfileHelp";
import { CONSTRAINT_LABELS, OP_LABELS } from "../../ruleEditors/helpers";

afterEach(cleanup);

/**
 * L'aide est écrite pour des gens qui saisissent des cartes, pas pour des développeurs : elle nomme
 * les libellés de l'interface et cite des figurines réelles. C'est précisément ce qui la rend
 * fragile - renommer un bouton ou une carte la périme en silence.
 *
 * Ces tests sont le garde-fou : ils échouent dès qu'un libellé décrit disparaît de l'écran, ou
 * qu'une figurine citée en exemple n'existe plus au catalogue.
 */

/** Ouvre une aide et renvoie son texte, tel que l'utilisateur le lit. */
function helpText(element: ReactElement): string {
  render(element);
  fireEvent.click(screen.getByRole("button", { name: "Aide" }));
  return screen.getByRole("dialog").textContent ?? "";
}

/** Libellés visibles d'une fiche de carte spéciale, dans la nature demandée. */
function cardLabels(kind: "auto" | "amelioration" | "ost"): string {
  const card = {
    ...catalog.specialCards[0],
    amelioration: kind === "amelioration" || undefined,
    ostScope: kind === "ost" || undefined,
    // La case « venues d'un autre peuple » n'existe qu'avec une portée de Fer de Lance : on en pose
    // une, sinon le test ne verrait jamais le libellé qu'il doit contrôler.
    scope: { ...catalog.specialCards[0].scope, ferDeLanceFactionIds: ["affranchis"] },
  };
  const { container } = render(
    <SpecialCardDetail
      card={card}
      cat={catalog}
      onChange={() => {}}
      onRemove={() => {}}
      onRenameId={() => {}}
    />,
  );
  return container.textContent ?? "";
}

describe("aide - les libellés décrits existent à l'écran", () => {
  it("nature d'une carte : les trois natures proposées sont expliquées", () => {
    const aide = helpText(<CardKindHelp />);
    cleanup();
    const ecran = cardLabels("auto");
    for (const nature of ["Automatique", "Amélioration", "Ost"]) {
      expect(ecran, `« ${nature} » a disparu de l'interface`).toContain(nature);
      expect(aide, `« ${nature} » n'est plus expliquée`).toContain(nature);
    }
  });

  it("nature d'une carte : les réglages d'une amélioration sont tous expliqués", () => {
    const aide = helpText(<CardKindHelp />);
    cleanup();
    const ecran = cardLabels("amelioration");
    for (const reglage of [
      "Groupe de choix exclusif",
      "Partagée",
      "Prix multiplié par le niveau",
      "Plusieurs exemplaires",
    ]) {
      expect(ecran, `« ${reglage} » a disparu de l'interface`).toContain(reglage);
      expect(aide, `« ${reglage} » n'est plus expliqué`).toContain(reglage);
    }
  });

  it("portée : les critères proposés sont tous expliqués, y compris la distinction délicate", () => {
    const aide = helpText(<CardScopeHelp />);
    cleanup();
    const ecran = cardLabels("auto");
    for (const critere of [
      "Trait",
      "Profils",
      "Factions",
      "Factions du Fer de Lance",
      "Seulement les figurines venues d’un autre peuple",
    ]) {
      expect(ecran, `« ${critere} » a disparu de l'interface`).toContain(critere);
    }
    // La distinction entre les deux portées de faction est le point le plus délicat de la fiche :
    // l'aide doit continuer de l'expliquer, pas seulement de la nommer.
    expect(aide).toContain("Factions du Fer de Lance");
    expect(aide).toContain("sous quelle bannière");
  });
});

describe("aide - toute action et toute contrainte proposées sont documentées", () => {
  /**
   * Le garde-fou principal : ajouter une action d'effet ou un type de contrainte sans l'expliquer
   * fait échouer ces deux tests, en nommant le libellé oublié. L'aide ne peut donc plus prendre du
   * retard sur l'interface sans qu'on le sache.
   */
  it("chaque action du menu des effets est décrite dans l'aide", () => {
    const aide = helpText(<EffectsHelp />);
    for (const label of Object.values(OP_LABELS)) {
      expect(aide, `l'action « ${label} » n'est pas expliquée dans l'aide des effets`).toContain(label);
    }
  });

  it("chaque type de contrainte est décrit dans l'aide", () => {
    const aide = helpText(<ConstraintsHelp />);
    for (const label of Object.values(CONSTRAINT_LABELS)) {
      expect(aide, `la contrainte « ${label} » n'est pas expliquée dans l'aide`).toContain(label);
    }
  });
});

describe("aide - les exemples cités existent au catalogue", () => {
  /** Tout ce que l'aide nomme comme exemple, et où le chercher. */
  const exemples: [collection: keyof typeof catalog, noms: string[]][] = [
    [
      "specialCards",
      ["Fille de Nyx", "Apprentie de Nyx", "Pacte du Secret", "Le couvert des bois", "Aguerri aux bois", "Lien de la Terre"],
    ],
    ["profiles", ["Gakere", "Engueran", "Guerrier Mongo", "Agent sombre", "Muskh"]],
    ["equipment", ["Madrier", "Canne des esprits"]],
  ];

  for (const [collection, noms] of exemples) {
    for (const nom of noms) {
      it(`« ${nom} » est toujours au catalogue (${collection})`, () => {
        const liste = catalog[collection] as unknown as { name?: string }[];
        expect(liste.some((e) => e.name === nom)).toBe(true);
      });
    }
  }

  it("les traits cités en exemple sont toujours portés par des figurines", () => {
    for (const trait of ["synkherces", "paladin"]) {
      expect(catalog.profiles.some((p) => p.traits.includes(trait)), trait).toBe(true);
    }
  });

  it("le peuple d'origine cité pour Gakere est bien celui de l'aide", () => {
    expect(catalog.profiles.find((p) => p.name === "Gakere")?.origin).toBe("gouns");
  });

  /**
   * L'aide affirme que la nature ne se déduit PAS du peuple d'origine : elle se pose à la main, et
   * la Guilde Noire n'en a aucune. Deux faits vérifiables, qu'un import distrait pourrait démentir.
   */
  it("un Affranchi d'origine carnivore porte bien la compétence, posée à la main", () => {
    const archer = catalog.profiles.find((p) => p.name === "Franc Archer Khârn")!;
    expect(archer.origin).toBe("kharns");
    expect(archer.skills.some((s) => s.skillId === "carnivore")).toBe(true);
  });

  it("aucune figurine de la Guilde Noire n'est carnivore, quelle que soit son origine", () => {
    const gn = catalog.profiles.filter((p) => p.factionId === "guilde-noire");
    expect(gn.some((p) => p.origin === "kharns" || p.origin === "fangs")).toBe(true);
    expect(gn.filter((p) => p.skills.some((s) => s.skillId === "carnivore"))).toEqual([]);
  });

  it("l'Agent sombre laisse toujours son origine au choix, entre les cinq peuples cités", () => {
    const agent = catalog.profiles.find((p) => p.name === "Agent sombre")!;
    expect(agent.originChoices).toEqual(["fangs", "gouns", "kharns", "kherops", "tembos"]);
  });
});

describe("aide - chaque section en a une, et elle s'ouvre", () => {
  const aides: [string, ReactElement][] = [
    ["identité", <IdentityHelp key="i" />],
    ["traits", <TraitsHelp key="t" />],
    ["effets", <EffectsHelp key="e" />],
    ["contraintes", <ConstraintsHelp key="c" />],
    ["nature d'une carte", <CardKindHelp key="k" />],
    ["portée d'une carte", <CardScopeHelp key="s" />],
  ];
  for (const [nom, element] of aides) {
    it(`l'aide « ${nom} » s'ouvre et dit quelque chose`, () => {
      render(element);
      fireEvent.click(screen.getByRole("button", { name: "Aide" }));
      const dialog = screen.getByRole("dialog");
      // Plusieurs titres : celui de la modale, puis les rubriques. C'est ce qu'on veut vérifier -
      // une aide sans rubrique serait un pavé.
      expect(within(dialog).getAllByRole("heading").length).toBeGreaterThan(1);
      expect((dialog.textContent ?? "").length).toBeGreaterThan(400);
    });
  }
});
